import { existsSync } from "node:fs";
import { join } from "node:path";

import { collectSourceFiles } from "../../context";
import type { IMetaRule, IViolation } from "../../types";

const SUFFIX_REQUIRES_TEST =
  /\.(service|utils|jobs|check|channel|helpers)\.ts$/u;

/*
 * Directories whose every module is logic by definition, regardless of
 * suffix: observability wrappers (metrics, tracing) and ACL resolution.
 * Barrel re-exports (index.ts) and type-only modules (*.types.ts) are
 * exempt — there is nothing to execute.
 */
const LOGIC_DIR_SEGMENTS = [
  join("src", "lib", "metrics"),
  join("src", "lib", "tracing"),
  join("src", "lib", "acl"),
] as const;

function isLogicFile(root: string, file: string): boolean {
  if (SUFFIX_REQUIRES_TEST.test(file)) {
    return true;
  }

  if (file.endsWith("/index.ts") || file.endsWith(".types.ts")) {
    return false;
  }

  return LOGIC_DIR_SEGMENTS.some((segment) =>
    file.startsWith(`${join(root, segment)}/`)
  );
}

export function checkLogicFilesHaveTests(root: string): IViolation[] {
  const violations: IViolation[] = [];
  const srcRoot = join(root, "src");

  for (const file of collectSourceFiles(srcRoot, [])) {
    if (!isLogicFile(root, file)) {
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
      )}\` to exist alongside this logic module (\`*.{service,utils,jobs,check,channel,helpers}.ts\` or anything under src/lib/{metrics,tracing,acl}) — every piece of logic ships with a test.`,
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
