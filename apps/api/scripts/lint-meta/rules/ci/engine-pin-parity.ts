import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { readApiPackageJson } from "../../parsers/package-json";
import type { IMetaRule, IViolation } from "../../types";

const PACKAGE_JSON = "package.json";
const RULE_ID = "engine-pin-parity";

/*
 * In a monorepo checkout the root package.json runs scripts of its own
 * (postinstall hooks, stack-check.sh), so its engines pin must not drift
 * from the app's. Standalone checkouts have no parent manifest — the
 * check no-ops there.
 */
function findParentPackageJsonDir(root: string): string | null {
  let current = dirname(root);

  for (;;) {
    if (existsSync(join(current, PACKAGE_JSON))) {
      return current;
    }

    const parent = dirname(current);

    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

export function checkEnginePinParity(root: string): IViolation[] {
  const violations: IViolation[] = [];
  const pkg = readApiPackageJson(root);
  const bunVersion = pkg?.engines?.bun;

  if (bunVersion === undefined || bunVersion.trim() === "") {
    violations.push({
      file: join(root, PACKAGE_JSON),
      rule: RULE_ID,
      message: "Missing package.json engines.bun pin for apps/api.",
    });

    return violations;
  }

  for (const dockerfile of ["Dockerfile", "Dockerfile.prod"]) {
    const dockerPath = join(root, dockerfile);

    if (!existsSync(dockerPath)) {
      continue;
    }

    const content = readFileSync(dockerPath, "utf8");

    if (!content.includes(`oven/bun:${bunVersion}`)) {
      violations.push({
        file: dockerPath,
        rule: RULE_ID,
        message: `Dockerfile must pin oven/bun:${bunVersion} to match package.json engines.bun.`,
      });
    }
  }

  const monorepoDir = findParentPackageJsonDir(root);

  if (monorepoDir !== null) {
    const rootPkg = readApiPackageJson(monorepoDir);

    if (rootPkg?.engines?.bun !== bunVersion) {
      violations.push({
        file: join(monorepoDir, PACKAGE_JSON),
        rule: RULE_ID,
        message: `Monorepo root package.json must pin engines.bun ${bunVersion} to match apps/api.`,
      });
    }
  }

  const ciWorkflow = join(root, ".github", "workflows", "ci.yml");

  if (existsSync(ciWorkflow)) {
    const content = readFileSync(ciWorkflow, "utf8");

    if (!content.includes(`bun-version: ${bunVersion}`)) {
      violations.push({
        file: ciWorkflow,
        rule: RULE_ID,
        message: `CI workflow must pin bun-version: ${bunVersion} to match package.json engines.bun.`,
      });
    }
  }

  return violations;
}

/** Bun pin must match across package.json, Dockerfiles, and CI. */
export const enginePinParityRule: IMetaRule = {
  id: RULE_ID,
  category: "ci",
  description:
    "Bun version pin must stay aligned across package.json, Docker, and CI.",
  run({ root }) {
    return checkEnginePinParity(root);
  },
};
