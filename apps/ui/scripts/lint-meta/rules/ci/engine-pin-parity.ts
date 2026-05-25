import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { readUiPackageJson } from "../../parsers/package-json";
import type { IMetaRule, IViolation } from "../../types";

function readNodeMajorFromNvmrc(root: string): string | null {
  const nvmrcPath = join(root, ".nvmrc");

  if (!existsSync(nvmrcPath)) {
    return null;
  }

  const major = readFileSync(nvmrcPath, "utf8").trim().split(".")[0];

  return major ?? null;
}

function checkPackageJsonNodeEngine(
  root: string,
  nodeMajor: string,
  pkg: ReturnType<typeof readUiPackageJson>
): IViolation[] {
  const enginesNode = pkg?.engines?.node ?? "";

  if (enginesNode.includes(nodeMajor)) {
    return [];
  }

  const enginesLabel = enginesNode.length === 0 ? "missing" : enginesNode;

  return [
    {
      file: join(root, "package.json"),
      rule: "engine-pin-parity",
      message: `package.json engines.node (${enginesLabel}) must reference Node ${nodeMajor} from .nvmrc.`
    }
  ];
}

function checkDockerNodePins(root: string, nodeMajor: string): IViolation[] {
  const violations: IViolation[] = [];

  for (const dockerfile of ["Dockerfile", "Dockerfile.prod"]) {
    const dockerPath = join(root, dockerfile);

    if (!existsSync(dockerPath)) {
      continue;
    }

    const content = readFileSync(dockerPath, "utf8");

    if (/FROM\s+oven\/bun:/u.test(content)) {
      continue;
    }

    if (!content.includes(`node:${nodeMajor}`)) {
      violations.push({
        file: dockerPath,
        rule: "engine-pin-parity",
        message: `Dockerfile must pin node:${nodeMajor} to match .nvmrc.`
      });
    }
  }

  return violations;
}

function checkWorkflowNodePins(root: string, nodeMajor: string): IViolation[] {
  const workflowDir = join(root, ".github", "workflows");

  if (!existsSync(workflowDir)) {
    return [];
  }

  const violations: IViolation[] = [];

  for (const file of readdirSync(workflowDir)) {
    if (!file.endsWith(".yml") && !file.endsWith(".yaml")) {
      continue;
    }

    const workflowPath = join(workflowDir, file);
    const content = readFileSync(workflowPath, "utf8");

    if (
      content.includes("setup-node") &&
      !content.includes("node-version-file: .nvmrc") &&
      !content.includes(`node-version: ${nodeMajor}`)
    ) {
      violations.push({
        file: workflowPath,
        rule: "engine-pin-parity",
        message:
          "Workflow uses setup-node but neither node-version-file: .nvmrc nor a matching node-version pin."
      });
    }
  }

  return violations;
}

function checkDockerBunPin(
  root: string,
  pkg: ReturnType<typeof readUiPackageJson>
): IViolation[] {
  const packageManager = pkg?.packageManager ?? "";
  const bunMatch = /^bun@([^+]+)/u.exec(packageManager);
  const bunVersion = bunMatch?.[1];

  if (bunVersion === undefined) {
    return [];
  }

  const violations: IViolation[] = [];

  for (const dockerfile of ["Dockerfile", "Dockerfile.prod"]) {
    const dockerPath = join(root, dockerfile);

    if (!existsSync(dockerPath)) {
      continue;
    }

    const content = readFileSync(dockerPath, "utf8");

    if (!/FROM\s+oven\/bun:/u.test(content)) {
      continue;
    }

    if (content.includes(`bun:${bunVersion}`)) {
      continue;
    }

    violations.push({
      file: dockerPath,
      rule: "engine-pin-parity",
      message: `Dockerfile must pin bun:${bunVersion} to match package.json packageManager.`
    });
  }

  return violations;
}

export function checkEnginePinParity(root: string): IViolation[] {
  const nodeMajor = readNodeMajorFromNvmrc(root);

  if (nodeMajor === null) {
    return [
      {
        file: join(root, ".nvmrc"),
        rule: "engine-pin-parity",
        message: "Missing .nvmrc — Node major pin required for apps/ui."
      }
    ];
  }

  const pkg = readUiPackageJson(root);

  return [
    ...checkPackageJsonNodeEngine(root, nodeMajor, pkg),
    ...checkDockerNodePins(root, nodeMajor),
    ...checkWorkflowNodePins(root, nodeMajor),
    ...checkDockerBunPin(root, pkg)
  ];
}

/** Node/Bun pins must match across .nvmrc, package.json, Dockerfiles, and workflows. */
export const enginePinParityRule: IMetaRule = {
  id: "engine-pin-parity",
  category: "ci",
  description:
    "Node and Bun version pins must stay aligned across .nvmrc, package.json, Docker, and CI.",
  run({ root }) {
    return checkEnginePinParity(root);
  }
};
