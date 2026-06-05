#!/usr/bin/env node
/*
 * Fail if any React component under src/components is never referenced
 * elsewhere in src. apps/docs has no knip (its Astro/MDX entry graph makes
 * knip's config brittle), so this is the dead-code guard for the component
 * layer — the equivalent of the `knip` step api/ui run in their `check`.
 *
 * A component is "referenced" if its basename (e.g. `CommandRun`) appears in
 * any other src file — an import, an MDX usage, or an .astro tag. Transitively
 * dead chains surface one layer per run (delete the leaf, re-run, repeat).
 *
 * Usage: node scripts/check-unused-components.mjs   (source-level; no build)
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src");
const COMPONENTS_DIR = join(SRC, "components");
const REFERENCE_EXTS = [".astro", ".mdx", ".md", ".ts", ".tsx", ".mjs"];

function walk(dir, exts) {
  const out = [];

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);

    if (statSync(full).isDirectory()) {
      out.push(...walk(full, exts));
      continue;
    }

    if (exts.some((ext) => full.endsWith(ext))) {
      out.push(full);
    }
  }

  return out;
}

const componentFiles = walk(COMPONENTS_DIR, [".tsx"]);
const sources = walk(SRC, REFERENCE_EXTS).map((file) => ({
  file,
  text: readFileSync(file, "utf8")
}));

const unused = componentFiles.filter((file) => {
  const name = basename(file, extname(file));
  const wordRe = new RegExp(`\\b${name}\\b`, "u");

  return !sources.some(
    (source) => source.file !== file && wordRe.test(source.text)
  );
});

if (unused.length > 0) {
  console.error(
    `[check-unused-components] ${unused.length} unreferenced component(s):`
  );

  for (const file of unused) {
    console.error(`  ${file.replace(SRC, "src")}`);
  }

  console.error("Delete them, or wire them into a page / .mdx / .astro.");
  process.exit(1);
}

console.log(
  `[check-unused-components] all ${componentFiles.length} components are referenced.`
);
