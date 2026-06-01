import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parsePackageJson } from "../../parsers/package-json";
import type { IMetaRule, IViolation } from "../../types";

const FORBID_DEP_PAIRS: readonly (readonly [string, string])[] = [
  ["react-hot-toast", "sonner"],
  ["axios", "openapi-fetch"],
  ["zod", "yup"],
  ["dayjs", "date-fns"],
];

export function checkDependencyPairs(file: string): IViolation[] {
  const violations: IViolation[] = [];
  const pkg = parsePackageJson(readFileSync(file, "utf8"));

  if (pkg === null) {
    return violations;
  }

  const merged: Record<string, string> = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  };

  for (const [firstPkg, secondPkg] of FORBID_DEP_PAIRS) {
    if (merged[firstPkg] !== undefined && merged[secondPkg] !== undefined) {
      violations.push({
        file,
        rule: "no-overlapping-libs",
        message: `Both "${firstPkg}" and "${secondPkg}" are listed — pick one (forbidden overlapping stacks).`,
      });
    }
  }

  return violations;
}

/** Forbid overlapping dependency stacks (e.g. axios + openapi-fetch). */
export const noOverlappingLibsRule: IMetaRule = {
  id: "no-overlapping-libs",
  category: "supply-chain",
  description:
    "package.json must not list forbidden overlapping library pairs.",
  run({ root }) {
    return checkDependencyPairs(join(root, "package.json"));
  },
};
