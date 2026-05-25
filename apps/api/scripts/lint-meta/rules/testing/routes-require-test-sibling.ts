import { existsSync } from "node:fs";
import { join } from "node:path";

import { collectSourceFiles } from "../../context";
import type { IMetaRule, IViolation } from "../../types";

export function checkRouteFilesHaveTests(root: string): IViolation[] {
  const violations: IViolation[] = [];
  const srcApi = join(root, "src", "api");
  const testsApi = join(root, "tests", "api");

  for (const file of collectSourceFiles(srcApi, [])) {
    if (!file.endsWith(".routes.ts")) {
      continue;
    }

    const relativeToSrcApi = file.slice(srcApi.length + 1);
    const expectedTest = join(
      testsApi,
      relativeToSrcApi.replace(/\.routes\.ts$/u, ".routes.test.ts")
    );

    if (existsSync(expectedTest)) {
      continue;
    }

    violations.push({
      file,
      rule: "routes-require-test-sibling",
      message: `Missing HTTP-level test file. Expected \`${expectedTest.slice(
        root.length + 1
      )}\` to exist alongside this route module.`,
    });
  }

  return violations;
}

/** Every *.routes.ts module must have a matching tests/api route test file. */
export const routesRequireTestSiblingRule: IMetaRule = {
  id: "routes-require-test-sibling",
  category: "testing",
  description:
    "Route modules must ship with a matching HTTP-level test under tests/api/.",
  run({ root }) {
    return checkRouteFilesHaveTests(root);
  },
};
