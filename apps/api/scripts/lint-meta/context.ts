import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";

import type { IMetaContext } from "./types";

export const SOURCE_EXTENSIONS = new Set([".ts"]);
export const SOURCE_DIRS = ["src", "tests"] as const;

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

/*
 * Workflows live at the app root when this template is a standalone repo, but
 * in a monorepo checkout they live at the repository root. Walk up from the
 * app root to the nearest `.github/workflows` so the CI rules
 * (github-actions-permissions, github-actions-timeout-required) always scan
 * the workflows that actually run for this code instead of silently no-oping.
 */
export function resolveWorkflowsDir(root: string): string {
  let current = root;

  for (;;) {
    const candidate = join(current, ".github", "workflows");

    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = dirname(current);

    if (parent === current) {
      return join(root, ".github", "workflows");
    }

    current = parent;
  }
}

export function buildContext(root: string): IMetaContext {
  const sourceFiles = [
    ...SOURCE_DIRS.flatMap((dir) =>
      collectSourceFiles(
        join(root, dir),
        dir === "tests" ? TESTS_LINT_META_SKIP : []
      )
    ),
    ...collectSourceFiles(join(root, "scripts"), []),
  ];

  return {
    root,
    sourceFiles,
    workflowFiles: findWorkflows(resolveWorkflowsDir(root)),
  };
}
