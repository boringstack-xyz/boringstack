import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { IMetaRule, IViolation } from "../../types";

const ESLINT_CONFIG_NAMES = [
  "eslint.config.mjs",
  "eslint.config.js",
  "eslint.config.mts",
  "eslint.config.cjs",
];

/*
 * Literal (non-glob) test-file paths quoted in eslint.config.* — the shape
 * used by per-file rule overrides. Glob patterns are skipped; they match
 * zero-or-more files by design.
 */
const TEST_PATH_LITERAL =
  /["']((?:tests|src|scripts|e2e)\/[^"'*?{}]+\.test\.tsx?)["']/gu;

export function checkEslintOverridePathsExist(root: string): IViolation[] {
  const violations: IViolation[] = [];

  for (const name of ESLINT_CONFIG_NAMES) {
    const full = join(root, name);

    if (!existsSync(full)) {
      continue;
    }

    const lines = readFileSync(full, "utf8").split("\n");

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];

      if (raw === undefined) {
        continue;
      }

      const noLineComment = raw.replace(/\/\/.*$/u, "");

      for (const match of noLineComment.matchAll(TEST_PATH_LITERAL)) {
        const relPath = match[1];

        if (relPath !== undefined && !existsSync(join(root, relPath))) {
          violations.push({
            file: full,
            rule: "eslint-override-paths-exist",
            message: `Line ${String(i + 1)}: override references \`${relPath}\`, which does not exist — remove the stale entry or restore the file.`,
          });
        }
      }
    }
  }

  return violations;
}

/** Literal test paths in eslint.config.* overrides must resolve to real files. */
export const eslintOverridePathsExistRule: IMetaRule = {
  id: "eslint-override-paths-exist",
  category: "config",
  description:
    "Literal test-file paths in eslint.config.* overrides must exist on disk.",
  run({ root }) {
    return checkEslintOverridePathsExist(root);
  },
};
