#!/usr/bin/env tsx
/**
 * After `bun run build`, every `<link rel="modulepreload">` in dist/index.html
 * must match at least one glob in `.size-limit.json`.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const INDEX_HTML = join(ROOT, "dist", "index.html");
const SIZE_LIMIT = join(ROOT, ".size-limit.json");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function globToRegExp(pattern: string): RegExp {
  let regex = "";

  for (const char of pattern) {
    if (char === "*") {
      regex += "[^/]*";
      continue;
    }

    regex += char.replace(/[.+^${}()|[\]\\]/gu, "\\$&");
  }

  return new RegExp(`^${regex}$`, "u");
}

function collectSizeLimitPatterns(entries: readonly unknown[]): string[] {
  const patterns: string[] = [];

  for (const entry of entries) {
    if (!isRecord(entry)) {
      continue;
    }

    const path = entry.path;

    if (Array.isArray(path)) {
      for (const pathPattern of path) {
        if (typeof pathPattern === "string") {
          patterns.push(pathPattern);
        }
      }

      continue;
    }

    if (typeof path === "string") {
      patterns.push(path);
    }
  }

  return patterns;
}

function normalizeAssetPath(href: string): string {
  const trimmed = href.replace(/^\//u, "");

  if (trimmed.startsWith("dist/")) {
    return trimmed;
  }

  return `dist/${trimmed}`;
}

function matchesSizeLimit(
  assetPath: string,
  patterns: readonly string[]
): boolean {
  const normalized = normalizeAssetPath(assetPath);

  return patterns.some((pattern) => globToRegExp(pattern).test(normalized));
}

function extractModulepreloadHrefs(html: string): string[] {
  const hrefs: string[] = [];
  const pattern =
    /<link\s+[^>]*rel=["']modulepreload["'][^>]*href=["']([^"']+)["']/giu;

  for (const match of html.matchAll(pattern)) {
    const href = match[1];

    if (href !== undefined) {
      hrefs.push(href);
    }
  }

  return hrefs;
}

function main(): void {
  if (!existsSync(INDEX_HTML)) {
    console.error(
      "[size:modulepreload] dist/index.html not found — run `bun run build` first."
    );
    process.exit(1);
  }

  const parsed: unknown = JSON.parse(readFileSync(SIZE_LIMIT, "utf8"));
  const entries: readonly unknown[] = Array.isArray(parsed) ? parsed : [];
  const patterns = collectSizeLimitPatterns(entries);
  const html = readFileSync(INDEX_HTML, "utf8");
  const hrefs = extractModulepreloadHrefs(html);
  const uncovered = hrefs.filter((href) => !matchesSizeLimit(href, patterns));

  if (uncovered.length === 0) {
    console.log(
      `[size:modulepreload] All ${String(hrefs.length)} modulepreload assets are covered by .size-limit.json.`
    );

    return;
  }

  console.error(
    `[size:modulepreload] ${String(uncovered.length)} modulepreload asset(s) missing from .size-limit.json:\n`
  );

  for (const href of uncovered) {
    console.error(`  ${href}`);
  }

  process.exit(1);
}

main();
