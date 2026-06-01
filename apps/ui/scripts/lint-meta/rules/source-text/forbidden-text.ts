import { readFileSync } from "node:fs";
import { join } from "node:path";

import { SOURCE_DIRS, collectSourceFiles } from "../../context";
import type { IMetaRule, IViolation } from "../../types";
import { createForbiddenTextPatterns } from "./forbidden-patterns";

export function checkForbiddenText(file: string, root: string): IViolation[] {
  const violations: IViolation[] = [];
  const text = readFileSync(file, "utf8");
  const patterns = createForbiddenTextPatterns(root);

  for (const rule of patterns) {
    if (rule.allow?.(file) === true) {
      continue;
    }

    if (rule.pattern.test(text)) {
      violations.push({
        file,
        rule: rule.rule,
        message: rule.message
      });
    }
  }

  return violations;
}

/**
 * Regex-based source bans ESLint cannot express on non-JS files: inline
 * disables, TS suppressions, raw HTML, env access, fetch, dark: variant.
 */
export const forbiddenTextRule: IMetaRule = {
  id: "forbidden-text",
  category: "source-text",
  description:
    "Source files must not contain inline lint/TS suppressions, raw HTML, direct env access, raw fetch, or banned Tailwind dark-mode variant classes.",
  run({ root }) {
    return SOURCE_DIRS.flatMap((dir) =>
      collectSourceFiles(join(root, dir)).flatMap((file) =>
        checkForbiddenText(file, root)
      )
    );
  }
};
