import { existsSync } from "node:fs";
import { join } from "node:path";

import { collectSourceFiles } from "../../context";
import type { IMetaRule, IViolation } from "../../types";

const SUFFIX_REQUIRES_TEST = /\.(service|utils|jobs|check|channel)\.ts$/u;

export function checkLogicFilesHaveTests(root: string): IViolation[] {
  const violations: IViolation[] = [];
  const srcRoot = join(root, "src");

  for (const file of collectSourceFiles(srcRoot, [])) {
    if (!SUFFIX_REQUIRES_TEST.test(file)) {
      continue;
    }

    const relativeToSrc = file.slice(srcRoot.length + 1);
    const expectedTest = join(
      root,
      "tests",
      relativeToSrc.replace(/\.ts$/u, ".test.ts")
    );

    if (existsSync(expectedTest)) {
      continue;
    }

    violations.push({
      file,
      rule: "logic-files-require-test-sibling",
      message: `Missing unit-test sibling. Expected \`${expectedTest.slice(
        root.length + 1
      )}\` to exist alongside this \`*.{service,utils,jobs,check,channel}.ts\` module — every piece of logic ships with a test.`,
    });
  }

  return violations;
}

/** Logic modules (*.service.ts, *.utils.ts, …) must have a tests/ mirror sibling. */
export const logicFilesRequireTestSiblingRule: IMetaRule = {
  id: "logic-files-require-test-sibling",
  category: "testing",
  description:
    "Logic modules must ship with a matching tests/**/*.test.ts sibling.",
  run({ root }) {
    return checkLogicFilesHaveTests(root);
  },
};
