#!/usr/bin/env node
/*
 * Guard against GFM markdown that ships to readers as literal source text.
 *
 * A misconfigured remark pipeline (e.g. GFM not wired into Starlight's MDX
 * processor) silently renders pipe tables as `| cell | cell |` and the
 * `|---|---|` delimiter row as plain text instead of <table>. The build
 * still succeeds, so the breakage only surfaces in the browser. This check
 * scans the built HTML for that residue and fails the build if it finds any.
 *
 * Detected residue (outside <pre>/<code>, where such syntax is shown as a
 * deliberate example):
 *   - GFM table delimiter rows: `|---|`, `| --- |`, `|:--|`, etc.
 *
 * Usage: node scripts/check-rendered-markdown.mjs   (after `astro build`)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist");

function walkHtml(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walkHtml(full));
    } else if (entry.endsWith(".html")) {
      out.push(full);
    }
  }
  return out;
}

/* Reduce a page to its visible prose so we only test real rendered text.
 * Order matters: drop code blocks (where literal table syntax is a legitimate
 * example) first, then strip every remaining tag — this also removes attribute
 * payloads like Expressive Code's `data-code="…"` copy-button cache, which
 * mirrors the code sample and would otherwise read as a false positive. */
function toProse(html) {
  return html
    .replace(/<pre[\s\S]*?<\/pre>/gi, " ")
    .replace(/<code[\s\S]*?<\/code>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

/* A GFM table delimiter row: a pipe adjacent to a run of 2+ dashes. Real
 * prose effectively never contains this; a rendered table never does either
 * (the delimiter becomes <table> structure). */
const DELIMITER = /\|\s*:?-{2,}|-{2,}:?\s*\|/;

const offenders = [];
for (const file of walkHtml(DIST)) {
  const text = toProse(readFileSync(file, "utf8"));
  if (DELIMITER.test(text)) {
    offenders.push(relative(DIST, file));
  }
}

if (offenders.length > 0) {
  console.error(
    "✗ Unrendered GFM table syntax found in built HTML (GFM pipeline broken?):",
  );
  for (const f of offenders) console.error(`  • ${f}`);
  console.error(
    "\nPipe tables are rendering as literal text. Ensure remark-gfm is wired\n" +
      "into markdown.remarkPlugins in astro.config.mjs.",
  );
  process.exit(1);
}

console.log("✓ No unrendered markdown table syntax in built HTML");
