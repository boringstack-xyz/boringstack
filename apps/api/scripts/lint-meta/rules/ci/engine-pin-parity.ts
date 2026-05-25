import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { readApiPackageJson } from "../../parsers/package-json";
import type { IMetaRule, IViolation } from "../../types";

export function checkEnginePinParity(root: string): IViolation[] {
  const violations: IViolation[] = [];
  const pkg = readApiPackageJson(root);
  const bunVersion = pkg?.engines?.bun;

  if (bunVersion === undefined || bunVersion.trim() === "") {
    violations.push({
      file: join(root, "package.json"),
      rule: "engine-pin-parity",
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
        rule: "engine-pin-parity",
        message: `Dockerfile must pin oven/bun:${bunVersion} to match package.json engines.bun.`,
      });
    }
  }

  const ciWorkflow = join(root, ".github", "workflows", "ci.yml");

  if (existsSync(ciWorkflow)) {
    const content = readFileSync(ciWorkflow, "utf8");

    if (!content.includes(`bun-version: ${bunVersion}`)) {
      violations.push({
        file: ciWorkflow,
        rule: "engine-pin-parity",
        message: `CI workflow must pin bun-version: ${bunVersion} to match package.json engines.bun.`,
      });
    }
  }

  return violations;
}

/** Bun pin must match across package.json, Dockerfiles, and CI. */
export const enginePinParityRule: IMetaRule = {
  id: "engine-pin-parity",
  category: "ci",
  description:
    "Bun version pin must stay aligned across package.json, Docker, and CI.",
  run({ root }) {
    return checkEnginePinParity(root);
  },
};
