import { readFileSync } from "node:fs";

import type { IMetaRule, IViolation } from "../../types";
import { createForbiddenTextPatterns } from "./forbidden-patterns";

export function checkForbiddenText(file: string): IViolation[] {
  const violations: IViolation[] = [];
  const text = readFileSync(file, "utf8");
  const patterns = createForbiddenTextPatterns();

  for (const rule of patterns) {
    if (rule.pattern.test(text)) {
      violations.push({
        file,
        rule: rule.rule,
        message: rule.message,
      });
    }
  }

  return violations;
}

/** Regex-based source bans ESLint cannot express: inline disables, TS suppressions. */
export const forbiddenTextRule: IMetaRule = {
  id: "forbidden-text",
  category: "source-text",
  description:
    "Source files must not contain inline lint/TS suppression comments.",
  run({ sourceFiles }) {
    return sourceFiles.flatMap(checkForbiddenText);
  },
};
