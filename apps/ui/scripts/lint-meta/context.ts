import { readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

import type { IMetaContext } from "./types";

export const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
export const SOURCE_DIRS = ["src", "tests", "e2e", ".storybook"] as const;

/*
 * Subtrees under SOURCE_DIRS that the source-text walk skips. Fixtures used
 * by tests/lint-meta/ deliberately violate the rules, so they must not be
 * scanned by the live lint:meta run — only by the tests that target them.
 * Must not match scripts/lint-meta/ (repo guardrail implementation).
 */
export const TESTS_LINT_META_SKIP = [join("tests", "lint-meta")] as const;

function shouldSkipDirectory(
  full: string,
  skipSubpaths: readonly string[]
): boolean {
  const normalized = full.replace(/\\/g, "/");

  return skipSubpaths.some((skip) => {
    const skipNorm = skip.replace(/\\/g, "/");

    return normalized.endsWith(`/${skipNorm}`) || normalized.endsWith(skipNorm);
  });
}

export function collectSourceFiles(
  dir: string,
  skipSubpaths: readonly string[] = TESTS_LINT_META_SKIP
): string[] {
  const out: string[] = [];
  let entries: string[];

  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }

  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);

    if (stat.isDirectory()) {
      if (shouldSkipDirectory(full, skipSubpaths)) {
        continue;
      }

      out.push(...collectSourceFiles(full, skipSubpaths));
      continue;
    }

    if (stat.isFile() && SOURCE_EXTENSIONS.has(extname(full))) {
      out.push(full);
    }
  }

  return out;
}

export function findWorkflows(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];

  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }

  for (const entry of entries) {
    const full = join(dir, entry);

    if (
      statSync(full).isFile() &&
      (entry.endsWith(".yml") || entry.endsWith(".yaml"))
    ) {
      out.push(full);
    }
  }

  return out;
}

export function buildContext(root: string): IMetaContext {
  const sourceFiles = [
    ...SOURCE_DIRS.flatMap((dir) =>
      collectSourceFiles(
        join(root, dir),
        dir === "tests" ? TESTS_LINT_META_SKIP : []
      )
    ),
    ...collectSourceFiles(join(root, "scripts"), [])
  ];

  return {
    root,
    sourceFiles,
    workflowFiles: findWorkflows(join(root, ".github", "workflows"))
  };
}
