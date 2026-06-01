import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parsePackageJson } from "../../parsers/package-json";
import type { IMetaRule, IViolation } from "../../types";

const NON_EXACT_DEP_PATTERN = /(^[~^])|([<>=*xX])|(\s)|(\|\|)/u;

export function checkExactDependencyVersions(file: string): IViolation[] {
  const violations: IViolation[] = [];
  const pkg = parsePackageJson(readFileSync(file, "utf8"));

  if (pkg === null) {
    return violations;
  }

  const sections = [
    ["dependencies", pkg.dependencies],
    ["devDependencies", pkg.devDependencies],
  ] as const;

  for (const [section, entries] of sections) {
    for (const [name, spec] of Object.entries(entries ?? {})) {
      if (!NON_EXACT_DEP_PATTERN.test(spec)) {
        continue;
      }

      violations.push({
        file,
        rule: "package-json-exact-deps",
        message: `${section}.${name} is "${spec}" — dependencies and devDependencies must be exact versions; only peerDependencies should use ranges.`,
      });
    }
  }

  return violations;
}

/** Exact versions in dependencies and devDependencies. */
export const packageJsonExactDepsRule: IMetaRule = {
  id: "package-json-exact-deps",
  category: "supply-chain",
  description:
    "dependencies and devDependencies must use exact versions (no ranges).",
  run({ root }) {
    return checkExactDependencyVersions(join(root, "package.json"));
  },
};
