import { readFileSync } from "node:fs";

import type { IMetaRule, IViolation } from "../../types";

/*
 * Single-entry-point for env config: the only file allowed to read
 * `process.env` is the validator. Everywhere else imports the typed
 * `env` object so misuses (wrong type, mistyped name, undefined-on-
 * unset) become typecheck errors. The validator + a couple of
 * standalone dev CLIs are the allowlist.
 *
 * Tests are not source code and freely seed `process.env` in their
 * setup files; the rule scopes itself to `src/` paths.
 */
const ALLOWLIST = new Set([
  "src/config/env/validate.ts",
  "src/templates/email/preview.ts",
]);

const PATTERN = /\bprocess\s*\.\s*env\b/u;

export function checkNoDirectProcessEnv(
  root: string,
  files: readonly string[]
): IViolation[] {
  const violations: IViolation[] = [];

  for (const file of files) {
    const relative = file.startsWith(root) ? file.slice(root.length + 1) : file;

    if (!relative.startsWith("src/")) {
      continue;
    }

    if (ALLOWLIST.has(relative)) {
      continue;
    }

    const text = readFileSync(file, "utf8");

    if (!PATTERN.test(text)) {
      continue;
    }

    /*
     * Comments and JSDoc that mention `process.env` for explanatory
     * purposes shouldn't trigger the rule. Strip line + block comments
     * before the final check.
     */
    const stripped = text
      .replace(/\/\*[\s\S]*?\*\//gu, "")
      .replace(/^\s*\/\/.*$/gmu, "");

    if (!PATTERN.test(stripped)) {
      continue;
    }

    violations.push({
      file,
      rule: "env-no-direct-process-env",
      message:
        "Direct `process.env` access is forbidden outside src/config/env/validate.ts. Import the typed `env` object from `src/config/env` instead.",
    });
  }

  return violations;
}

export const noDirectProcessEnvRule: IMetaRule = {
  id: "env-no-direct-process-env",
  category: "env",
  description:
    "Single entry point for env: every source file outside validate.ts must import the typed `env` object instead of reading `process.env` directly.",
  run({ root, sourceFiles }) {
    return checkNoDirectProcessEnv(root, sourceFiles);
  },
};
