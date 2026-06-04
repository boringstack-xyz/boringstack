import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { IMetaRule, IViolation } from "../../types";

export function checkEslintConfigNoWarn(root: string): IViolation[] {
  const violations: IViolation[] = [];
  const names = [
    "eslint.config.mjs",
    "eslint.config.js",
    "eslint.config.mts",
    "eslint.config.cjs"
  ];

  for (const name of names) {
    const full = join(root, name);

    if (!existsSync(full)) {
      continue;
    }

    const lines = readFileSync(full, "utf8").split("\n");

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];

      if (raw === undefined || raw.includes("eslint-meta-disable-warn")) {
        continue;
      }

      const noLineComment = raw.replace(/\/\/.*$/u, "").trim();

      if (noLineComment === "") {
        continue;
      }

      if (!/(?:^|[\s,[(])["']warn["'](?:$|[\s,)\]])/u.test(noLineComment)) {
        continue;
      }

      violations.push({
        file: full,
        rule: "eslint-config-no-warn",
        message: `Line ${String(i + 1)}: ESLint severities must be "error" or "off", not "warn" (or add // eslint-meta-disable-warn on the same line).`
      });
    }
  }

  return violations;
}

/** ESLint config severities must be error or off, never warn. */
export const eslintConfigNoWarnRule: IMetaRule = {
  id: "eslint-config-no-warn",
  category: "config",
  description: 'ESLint severities must be "error" or "off", not "warn".',
  run({ root }) {
    return checkEslintConfigNoWarn(root);
  }
};
