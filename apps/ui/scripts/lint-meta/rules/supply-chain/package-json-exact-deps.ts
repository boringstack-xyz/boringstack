import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parsePackageJson } from "../../parsers/package-json";
import type { IMetaRule, IViolation } from "../../types";

export function checkPackageJson(file: string): IViolation[] {
  const violations: IViolation[] = [];
  const { pkg, parseError } = parsePackageJson(readFileSync(file, "utf8"));

  if (pkg === null) {
    violations.push({
      file,
      rule: "package-json-exact-deps",
      message: `Could not parse JSON: ${parseError ?? "unknown error"}`
    });

    return violations;
  }

  for (const [key, value] of Object.entries(pkg.dependencies ?? {})) {
    if (/^[~^]/.test(value)) {
      violations.push({
        file,
        rule: "package-json-exact-deps",
        message: `dependencies."${key}" must be exact (no ^ or ~): "${value}"`
      });
    }
  }

  for (const [key, value] of Object.entries(pkg.devDependencies ?? {})) {
    if (/^[~^]/.test(value)) {
      violations.push({
        file,
        rule: "package-json-exact-deps",
        message: `devDependencies."${key}" must be exact (no ^ or ~): "${value}"`
      });
    }
  }

  for (const [key, value] of Object.entries(pkg.peerDependencies ?? {})) {
    if (!value.startsWith("^") && !value.startsWith("github:")) {
      violations.push({
        file,
        rule: "package-json-exact-deps",
        message: `peerDependencies."${key}" must use caret (^): "${value}"`
      });
    }
  }

  return violations;
}

/** Exact versions in dependencies/devDependencies; caret in peerDependencies. */
export const packageJsonExactDepsRule: IMetaRule = {
  id: "package-json-exact-deps",
  category: "supply-chain",
  description:
    "dependencies and devDependencies must use exact versions; peerDependencies must use caret (^).",
  run({ root }) {
    return checkPackageJson(join(root, "package.json"));
  }
};
