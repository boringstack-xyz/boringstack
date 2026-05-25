#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const README_PATH = join(ROOT, "scripts", "README.md");
const PACKAGE_JSON_PATH = join(ROOT, "package.json");

const SKIP_SCRIPT_KEYS = new Set(["prepare"]);

function referencesScriptsDir(value: string): boolean {
  return /(?:^|[&|;]\s*|\s)(?:\.\/)?scripts\//u.test(value);
}

function readPackageScriptKeys(): string[] {
  const parsed: unknown = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8"));

  if (typeof parsed !== "object" || parsed === null || !("scripts" in parsed)) {
    return [];
  }

  const scripts = parsed.scripts;

  if (typeof scripts !== "object" || scripts === null) {
    return [];
  }

  return Object.entries(scripts)
    .filter(([key, value]) => {
      if (SKIP_SCRIPT_KEYS.has(key)) {
        return false;
      }

      if (typeof value !== "string") {
        return false;
      }

      return referencesScriptsDir(value);
    })
    .map(([key]) => key);
}

function readReadmeCommandKeys(): Set<string> {
  const text = readFileSync(README_PATH, "utf8");
  const keys = new Set<string>();

  for (const match of text.matchAll(/\|\s*`bun run\s+([^`]+)`\s*\|/gu)) {
    const key = match[1]?.trim();

    if (key !== undefined && key.length > 0) {
      keys.add(key);
    }
  }

  return keys;
}

function main(): void {
  const wired = readPackageScriptKeys();
  const documented = readReadmeCommandKeys();
  const missing = wired.filter((key) => !documented.has(key));

  if (missing.length > 0) {
    console.error(
      "[check:scripts-docs] scripts/README.md is missing package.json commands:\n"
    );

    for (const key of missing) {
      console.error(`  - bun run ${key}`);
    }

    process.exit(1);
  }

  console.log(
    "[check:scripts-docs] scripts/README.md covers all wired commands."
  );
}

main();
