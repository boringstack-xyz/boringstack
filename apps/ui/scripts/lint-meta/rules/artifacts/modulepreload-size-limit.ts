import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { IMetaRule, IViolation } from "../../types";

const REQUIRED_MODULEPRELOAD_SIZE_PATTERNS = [
  "dist/assets/index-*.js",
  "dist/assets/react-*.js",
  "dist/assets/router-*.js",
  "dist/assets/i18n-*.js",
  "dist/assets/query-*.js",
  "dist/assets/rolldown-runtime-*.js",
  "dist/assets/logger-*.js",
  "dist/assets/client-*.js"
] as const;

interface ISizeLimitEntry {
  path?: string | readonly string[];
}

function isSizeLimitEntry(value: unknown): value is ISizeLimitEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  if (!("path" in value)) {
    return true;
  }

  const path = value.path;

  if (path === undefined) {
    return true;
  }

  if (typeof path === "string") {
    return true;
  }

  return (
    Array.isArray(path) && path.every((entry) => typeof entry === "string")
  );
}

function parseSizeLimitEntries(raw: unknown): ISizeLimitEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter(isSizeLimitEntry);
}

function collectSizeLimitPatterns(
  entries: readonly ISizeLimitEntry[]
): string[] {
  const patterns: string[] = [];

  for (const entry of entries) {
    if (entry.path === undefined) {
      continue;
    }

    if (Array.isArray(entry.path)) {
      for (const pathPattern of entry.path) {
        if (typeof pathPattern !== "string") {
          continue;
        }

        patterns.push(pathPattern);
      }

      continue;
    }

    if (typeof entry.path === "string") {
      patterns.push(entry.path);
    }
  }

  return patterns;
}

export function checkModulepreloadSizeLimitPatterns(
  root: string
): IViolation[] {
  const sizeLimitPath = join(root, ".size-limit.json");

  if (!existsSync(sizeLimitPath)) {
    return [];
  }

  const parsed: unknown = JSON.parse(readFileSync(sizeLimitPath, "utf8"));
  const patterns = collectSizeLimitPatterns(parseSizeLimitEntries(parsed));
  const violations: IViolation[] = [];

  for (const required of REQUIRED_MODULEPRELOAD_SIZE_PATTERNS) {
    if (!patterns.includes(required)) {
      violations.push({
        file: sizeLimitPath,
        rule: "modulepreload-size-limit-coverage",
        message: `Missing size budget glob \`${required}\` for modulepreload coverage.`
      });
    }
  }

  return violations;
}

/** .size-limit.json must budget every modulepreload chunk glob. */
export const modulepreloadSizeLimitRule: IMetaRule = {
  id: "modulepreload-size-limit-coverage",
  category: "artifacts",
  description:
    ".size-limit.json must include globs for all modulepreload entry chunks.",
  run({ root }) {
    return checkModulepreloadSizeLimitPatterns(root);
  }
};
