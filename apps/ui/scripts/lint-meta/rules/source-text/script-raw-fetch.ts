import { readFileSync } from "node:fs";

import type { IMetaRule, IViolation } from "../../types";

const RAW_FETCH_SCRIPT_ALLOWLIST = new Set([
  "scripts/lint-meta/rules/ci/github-actions-permissions.ts"
]);

export function checkScriptRawFetch(
  root: string,
  files: readonly string[]
): IViolation[] {
  const violations: IViolation[] = [];

  for (const file of files) {
    const relative = file.startsWith(root) ? file.slice(root.length + 1) : file;

    if (!relative.startsWith("scripts/")) {
      continue;
    }

    if (RAW_FETCH_SCRIPT_ALLOWLIST.has(relative)) {
      continue;
    }

    const lines = readFileSync(file, "utf8").split("\n");

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index] ?? "";
      const trimmed = line.trim();

      if (
        trimmed.startsWith("//") ||
        trimmed.startsWith("*") ||
        trimmed.startsWith("message:")
      ) {
        continue;
      }

      if (/\bfetch\s*\(/u.test(line)) {
        violations.push({
          file,
          rule: "no-raw-fetch",
          message: `Line ${String(index + 1)}: scripts must not call the global fetch API directly (allowlist: scripts/lint-meta/rules/ci/github-actions-permissions.ts for GitHub SHA verify).`
        });
      }
    }
  }

  return violations;
}

/** Scripts must not call fetch directly (except GitHub SHA verify in lint-meta CI rule). */
export const scriptRawFetchRule: IMetaRule = {
  id: "no-raw-fetch-scripts",
  category: "source-text",
  description:
    "Scripts must not call global fetch except github-actions-permissions.ts (lint:meta --verify SHA check).",
  run({ root, sourceFiles }) {
    return checkScriptRawFetch(root, sourceFiles);
  }
};
