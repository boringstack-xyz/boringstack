import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

import type { IMetaRule, IViolation } from "../../types";

const GLOB_CHARS_REGEX = /[*?{}]/u;

function stripJsonComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/^\s*\/\/.*$/gmu, "")
    .replace(/,\s*([\]}])/gu, "$1");
}

function readLiteralEntries(tsconfigPath: string): string[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(stripJsonComments(readFileSync(tsconfigPath, "utf8")));
  } catch {
    return [];
  }

  if (typeof parsed !== "object" || parsed === null) {
    return [];
  }

  const entries: string[] = [];
  const candidates: unknown[] = [];

  if ("include" in parsed) {
    candidates.push(parsed.include);
  }

  if ("files" in parsed) {
    candidates.push(parsed.files);
  }

  for (const value of candidates) {
    if (!Array.isArray(value)) {
      continue;
    }

    for (const item of value) {
      if (typeof item !== "string" || GLOB_CHARS_REGEX.test(item)) {
        continue;
      }

      /*
       * Entries under hidden directories (.astro/types.d.ts, …) are
       * build-generated and legitimately absent on a fresh clone —
       * only hand-authored paths are checked.
       */
      if (item.replace(/^\.\//u, "").startsWith(".")) {
        continue;
      }

      entries.push(item);
    }
  }

  return entries;
}

function checkOneTsconfig(tsconfigPath: string): IViolation[] {
  const violations: IViolation[] = [];
  const baseDir = dirname(tsconfigPath);

  for (const entry of readLiteralEntries(tsconfigPath)) {
    if (!existsSync(join(baseDir, entry))) {
      violations.push({
        file: tsconfigPath,
        rule: "tsconfig-include-paths-exist",
        message: `include/files entry \`${entry}\` does not exist on disk — stale config references misdocument the project shape (globs are exempt).`
      });
    }
  }

  return violations;
}

/*
 * Same class as eslint-override-paths-exist: literal paths quoted in a
 * config file must exist on disk. TypeScript silently tolerates missing
 * `include` entries, so a stale reference (e.g. an abandoned
 * worker-configuration.d.ts) lives on forever, misdocumenting the
 * deploy model. Checks this app plus every sibling app's root
 * tsconfig.json — siblings without their own lint-meta (apps/docs) are
 * otherwise unguarded.
 */
export function checkTsconfigIncludePathsExist(root: string): IViolation[] {
  const violations: IViolation[] = checkOneTsconfig(
    join(root, "tsconfig.json")
  );
  const appsDir = dirname(root);
  let siblings: string[];

  try {
    siblings = readdirSync(appsDir);
  } catch {
    return violations;
  }

  for (const entry of siblings) {
    const siblingTsconfig = join(appsDir, entry, "tsconfig.json");

    if (join(appsDir, entry) === root || !existsSync(siblingTsconfig)) {
      continue;
    }

    try {
      if (!statSync(join(appsDir, entry)).isDirectory()) {
        continue;
      }
    } catch {
      continue;
    }

    violations.push(...checkOneTsconfig(siblingTsconfig));
  }

  return violations;
}

/** Literal tsconfig include/files paths must exist on disk. */
export const tsconfigIncludePathsExistRule: IMetaRule = {
  id: "tsconfig-include-paths-exist",
  category: "config",
  description:
    "Literal tsconfig include/files entries must point at files that exist (globs exempt); checks this app and sibling apps.",
  run({ root }) {
    return checkTsconfigIncludePathsExist(root);
  }
};
