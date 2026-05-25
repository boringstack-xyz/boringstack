import { existsSync } from "node:fs";
import { join } from "node:path";

import { collectSourceFiles } from "../../context";
import type { IMetaRule, IViolation } from "../../types";

/*
 * Suffixes that flag a file as "logic, must have a sibling test."
 * Pure-presentation `.tsx` components are intentionally excluded — they
 * are covered by Storybook + Playwright; unit-testing every leaf
 * component is overkill.
 */
const LOGIC_SUFFIX_REGEX =
  /\.(utils|queries|mutations|hooks|schemas|store|service)\.(ts|tsx)$/u;

export function checkLogicFilesHaveTests(root: string): IViolation[] {
  const violations: IViolation[] = [];
  const srcRoot = join(root, "src");

  for (const file of collectSourceFiles(srcRoot)) {
    if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) {
      continue;
    }

    if (!LOGIC_SUFFIX_REGEX.test(file)) {
      continue;
    }

    const tsTest = file.replace(/\.(ts|tsx)$/u, ".test.ts");
    const tsxTest = file.replace(/\.(ts|tsx)$/u, ".test.tsx");

    if (existsSync(tsTest) || existsSync(tsxTest)) {
      continue;
    }

    violations.push({
      file,
      rule: "logic-files-require-test-sibling",
      message: `Missing colocated test. Expected \`${tsTest.slice(
        root.length + 1
      )}\` (or \`.test.tsx\`) to exist next to this \`*.{utils,queries,mutations,hooks,schemas,store,service}.{ts,tsx}\` module — every piece of logic ships with a test.`
    });
  }

  return violations;
}

/** Logic modules (*.hooks.ts, *.queries.ts, …) must have a colocated test sibling. */
export const logicFilesRequireTestSiblingRule: IMetaRule = {
  id: "logic-files-require-test-sibling",
  category: "testing",
  description:
    "Logic modules must ship with a colocated *.test.ts or *.test.tsx sibling.",
  run({ root }) {
    return checkLogicFilesHaveTests(root);
  }
};
