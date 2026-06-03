import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { resolveWorkflowsDir } from "../../context";
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

/*
 * Workflows live at the app root in a standalone checkout but at the
 * repository root in a monorepo (see resolveWorkflowsDir). Scanning the
 * resolved directory keeps the pin checks honest in both layouts instead of
 * silently no-oping when the app-local .github/workflows is absent.
 */
function listWorkflowFiles(root: string): string[] {
  const workflowDir = resolveWorkflowsDir(root);

  if (!existsSync(workflowDir)) {
    return [];
  }

  return readdirSync(workflowDir)
    .filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"))
    .map((file) => join(workflowDir, file));
}

function checkWorkflowNodePins(root: string, nodeMajor: string): IViolation[] {
  const violations: IViolation[] = [];

  for (const workflowPath of listWorkflowFiles(root)) {
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

function checkWorkflowBunPins(
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

  for (const workflowPath of listWorkflowFiles(root)) {
    const content = readFileSync(workflowPath, "utf8");

    for (const match of content.matchAll(/bun-version:\s*(\S+)/gu)) {
      const pinned = match[1];

      if (pinned !== undefined && pinned !== bunVersion) {
        violations.push({
          file: workflowPath,
          rule: "engine-pin-parity",
          message: `Workflow pins bun-version: ${pinned} but package.json packageManager declares bun@${bunVersion}.`
        });
      }
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

/*
 * In a monorepo checkout the root package.json runs scripts of its own
 * (postinstall hooks, stack-check.sh), so its engines.bun pin must not
 * drift from the app's packageManager pin. Standalone checkouts have no
 * parent manifest — the check no-ops there.
 */
function checkMonorepoRootBunPin(
  root: string,
  pkg: ReturnType<typeof readUiPackageJson>
): IViolation[] {
  const packageManager = pkg?.packageManager ?? "";
  const bunMatch = /^bun@([^+]+)/u.exec(packageManager);
  const bunVersion = bunMatch?.[1];

  if (bunVersion === undefined) {
    return [];
  }

  let current = dirname(root);

  for (;;) {
    const candidate = join(current, "package.json");

    if (existsSync(candidate)) {
      const parsed: unknown = JSON.parse(readFileSync(candidate, "utf8"));
      const engines =
        typeof parsed === "object" && parsed !== null && "engines" in parsed
          ? parsed.engines
          : undefined;
      const bunPin =
        typeof engines === "object" && engines !== null && "bun" in engines
          ? engines.bun
          : undefined;

      if (bunPin === bunVersion) {
        return [];
      }

      return [
        {
          file: candidate,
          rule: "engine-pin-parity",
          message: `Monorepo root package.json must pin engines.bun ${bunVersion} to match apps/ui.`
        }
      ];
    }

    const parent = dirname(current);

    if (parent === current) {
      return [];
    }

    current = parent;
  }
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
    ...checkWorkflowBunPins(root, pkg),
    ...checkDockerBunPin(root, pkg),
    ...checkMonorepoRootBunPin(root, pkg)
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
