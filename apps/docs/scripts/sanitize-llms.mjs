#!/usr/bin/env node
/*
 * Strip MDX residue from the generated llms*.txt files.
 *
 * starlight-llms-txt runs with `rawContent: true` because turning it off
 * makes the plugin render index.mdx, which mounts a React component its
 * render context has no renderer for (see the comment in astro.config.mjs).
 * The side effect is that the MDX pipeline never runs, so component imports
 * and JSX tags land verbatim in the output:
 *
 *   import LandingPage from "../../components/landing/LandingPage";
 *   <LandingPage client:load />
 *   <Aside type="danger" title="...">
 *
 * None of that is content. An agent reading llms-full.txt hits 46 import
 * lines and a handful of unresolvable component tags. This pass removes them
 * while keeping the text those components wrapped, because the prose inside
 * an <Aside> is often the most important sentence on the page.
 *
 * Fenced code blocks are left completely alone: a code sample may legitimately
 * contain an import statement or a JSX tag, and mangling it would be worse
 * than the residue.
 *
 * Run after `astro build`. Idempotent.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIST = join(import.meta.dirname, "..", "dist");
const FILES = ["llms.txt", "llms-small.txt", "llms-full.txt"];

/* Component tags to unwrap. Content between the open and close tag is kept;
 * only the tags themselves go. Self-closing forms are dropped outright since
 * they render as UI, not text. */
const KNOWN_COMPONENTS = [
  "Aside",
  "DocCallout",
  "LandingPage",
  "Tabs",
  "TabItem",
  "Card",
  "CardGrid",
  "LinkCard",
  "Steps",
  "Badge",
  "FileTree",
  "Code",
  "LintMetaCatalog",
  "ScriptsCatalog",
  "DataMatrix",
  "HowToSchema",
  "CostCalculator",
];

/** Split into fenced-code and prose segments so code is never touched. */
function segment(text) {
  const segments = [];
  const lines = text.split("\n");
  let buffer = [];
  let fence = null;

  const flush = (isCode) => {
    if (buffer.length > 0) {
      segments.push({ isCode, text: buffer.join("\n") });
      buffer = [];
    }
  };

  for (const line of lines) {
    const opener = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fence === null && opener) {
      flush(false);
      fence = opener[1][0].repeat(opener[1].length);
      buffer.push(line);
      continue;
    }
    if (fence !== null) {
      buffer.push(line);
      // A closing fence is the same character, at least as long, nothing else.
      if (new RegExp(`^\\s*${fence[0]}{${fence.length},}\\s*$`).test(line)) {
        flush(true);
        fence = null;
      }
      continue;
    }
    buffer.push(line);
  }
  flush(fence !== null);
  return segments;
}

function sanitizeProse(text) {
  let out = text;

  // ESM imports and re-exports that leaked from MDX frontmatter bodies.
  out = out.replace(/^[ \t]*import\s+[^\n]*?\s+from\s+["'][^"'\n]+["'];?[ \t]*$/gm, "");
  out = out.replace(/^[ \t]*import\s+["'][^"'\n]+["'];?[ \t]*$/gm, "");
  out = out.replace(/^[ \t]*export\s+(?:const|default|function)\s[^\n]*$/gm, "");

  const names = KNOWN_COMPONENTS.join("|");

  // Self-closing component tags, possibly spanning lines: `<LandingPage client:load />`
  out = out.replace(new RegExp(`<(?:${names})\\b[^>]*?/>`, "gs"), "");
  // Opening and closing tags of wrapper components; inner text survives.
  out = out.replace(new RegExp(`</?(?:${names})\\b[^>]*?>`, "gs"), "");

  // Collapse the blank-line runs the removals leave behind.
  out = out.replace(/\n{4,}/g, "\n\n\n");

  return out;
}

let changedAny = false;
for (const name of FILES) {
  const path = join(DIST, name);
  if (!existsSync(path)) {
    console.error(`sanitize-llms: ${name} not found in dist/ — did astro build run?`);
    process.exitCode = 1;
    continue;
  }

  const before = readFileSync(path, "utf8");
  const after = segment(before)
    .map((s) => (s.isCode ? s.text : sanitizeProse(s.text)))
    .join("\n");

  if (after !== before) {
    writeFileSync(path, after, "utf8");
    changedAny = true;
    const saved = before.length - after.length;
    console.log(
      `sanitize-llms: ${name}  ${before.length} -> ${after.length} bytes (-${saved})`,
    );
  } else {
    console.log(`sanitize-llms: ${name}  already clean`);
  }
}

if (!changedAny) {
  console.log("sanitize-llms: nothing to strip");
}
