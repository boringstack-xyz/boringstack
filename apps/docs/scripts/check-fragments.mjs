#!/usr/bin/env node
/*
 * Verify every intra-site fragment link in the built docs resolves to a
 * real element id. lychee's --include-fragments cannot do this: it does
 * not apply the directory -> index.html fallback that pretty URLs use,
 * so it false-positives on essentially every internal docs anchor.
 *
 * Usage: node scripts/check-fragments.mjs   (after `astro build`)
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist");

/* Anchors browsers/Starlight resolve without a matching id. */
const FRAGMENT_ALLOWLIST = new Set(["", "_top"]);

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

/** Resolve a site-absolute path ("/api/acl/") to its built HTML file. */
function resolveTarget(sitePath) {
  const rel = sitePath.replace(/^\//, "").replace(/\/$/, "");
  const candidates =
    rel === ""
      ? [join(DIST, "index.html")]
      : [join(DIST, rel, "index.html"), join(DIST, `${rel}.html`), join(DIST, rel)];

  return candidates.find((file) => existsSync(file) && statSync(file).isFile());
}

const idCache = new Map();

function idsOf(file) {
  if (!idCache.has(file)) {
    const ids = new Set();

    for (const match of readFileSync(file, "utf8").matchAll(
      /\bid="([^"]+)"/gu
    )) {
      ids.add(match[1]);
    }

    idCache.set(file, ids);
  }

  return idCache.get(file);
}

const errors = [];

for (const file of walkHtml(DIST)) {
  const html = readFileSync(file, "utf8");

  for (const match of html.matchAll(/\bhref="([^"]+)"/gu)) {
    const href = match[1];

    let sitePath;
    let fragment;

    if (href.startsWith("#")) {
      sitePath = null;
      fragment = href.slice(1);
    } else if (href.startsWith("/") && href.includes("#")) {
      const [path, frag] = href.split("#", 2);

      sitePath = path;
      fragment = frag;
    } else {
      continue;
    }

    fragment = decodeURIComponent(fragment);

    if (FRAGMENT_ALLOWLIST.has(fragment)) {
      continue;
    }

    const target = sitePath === null ? file : resolveTarget(sitePath);

    if (target === undefined) {
      errors.push(`${file}: link target not found for \`${href}\``);
      continue;
    }

    if (!idsOf(target).has(fragment)) {
      errors.push(`${file}: dead fragment \`${href}\` (no id="${fragment}")`);
    }
  }
}

if (errors.length > 0) {
  console.error(`[check-fragments] ${errors.length} dead fragment link(s):`);

  for (const error of errors) {
    console.error(`  ${error.replace(DIST, "dist")}`);
  }

  process.exit(1);
}

console.log("[check-fragments] all intra-site fragment links resolve.");
