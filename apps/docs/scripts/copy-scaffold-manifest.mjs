#!/usr/bin/env node
/*
 * Publish .tsforge/scaffold-manifest.json as a static asset.
 *
 * The manifest is the single machine-readable description of this stack's
 * config surface: every field with its kind and per-STACK defaults, the
 * services each toggle spawns, the secrets each one requires, and the
 * cross-rules between them. It is the most useful file in the repo for an
 * agent asked to "set this up", and it was previously reachable only by
 * cloning, and named after a tool that lives in a different repository.
 *
 * Serving it at https://boringstack.xyz/scaffold-manifest.json makes it the
 * public agent contract, of which tsforge is one consumer.
 *
 * Copied rather than duplicated by hand, with a --check mode wired into
 * build:ci so the published copy cannot drift from the source. Same pattern
 * as generate-lint-meta-docs.mjs and generate-scripts-docs.mjs.
 *
 *   node scripts/copy-scaffold-manifest.mjs           # write public/
 *   node scripts/copy-scaffold-manifest.mjs --check   # fail on drift
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..", "..");
const SOURCE = join(REPO_ROOT, ".tsforge", "scaffold-manifest.json");
const DEST = join(import.meta.dirname, "..", "public", "scaffold-manifest.json");

const check = process.argv.includes("--check");

if (!existsSync(SOURCE)) {
  console.error(`scaffold-manifest: source missing at ${SOURCE}`);
  process.exit(1);
}

const source = readFileSync(SOURCE, "utf8");

// Parse before publishing: a malformed manifest served to agents is worse
// than no manifest, and the parse is the only validation available here.
let parsed;
try {
  parsed = JSON.parse(source);
} catch (error) {
  console.error(`scaffold-manifest: source is not valid JSON — ${error.message}`);
  process.exit(1);
}

for (const key of ["manifestVersion", "repo", "defaultRef", "fields"]) {
  if (parsed[key] === undefined) {
    console.error(`scaffold-manifest: source is missing required key "${key}"`);
    process.exit(1);
  }
}

if (check) {
  if (!existsSync(DEST)) {
    console.error(
      "scaffold-manifest: public/scaffold-manifest.json is missing.\n" +
        "  fix: bun run generate:scaffold-manifest",
    );
    process.exit(1);
  }
  if (readFileSync(DEST, "utf8") !== source) {
    console.error(
      "scaffold-manifest: public/scaffold-manifest.json has drifted from .tsforge/scaffold-manifest.json.\n" +
        "  fix: bun run generate:scaffold-manifest",
    );
    process.exit(1);
  }
  console.log(
    `scaffold-manifest: in sync (v${parsed.manifestVersion}, ${parsed.fields.length} fields)`,
  );
} else {
  writeFileSync(DEST, source, "utf8");
  console.log(
    `scaffold-manifest: published v${parsed.manifestVersion} (${parsed.fields.length} fields) to public/`,
  );
}
