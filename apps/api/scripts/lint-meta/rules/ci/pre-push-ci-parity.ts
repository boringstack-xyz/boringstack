import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { IMetaRule, IViolation } from "../../types";

const PRE_PUSH_MANIFEST = join("scripts", "ci", "pre-push.manifest.json");

function readPrePushManifest(manifestPath: string): {
  readonly ciWorkflow: string;
  readonly requiredCommands: readonly string[];
} | null {
  const parsed: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));

  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  if (!("ciWorkflow" in parsed) || !("requiredCommands" in parsed)) {
    return null;
  }

  const ciWorkflow = parsed.ciWorkflow;
  const requiredCommands = parsed.requiredCommands;

  if (
    typeof ciWorkflow !== "string" ||
    !Array.isArray(requiredCommands) ||
    !requiredCommands.every((entry) => typeof entry === "string")
  ) {
    return null;
  }

  return { ciWorkflow, requiredCommands };
}

export function checkPrePushParity(root: string): IViolation[] {
  const manifestPath = join(root, PRE_PUSH_MANIFEST);
  const workflowPath = join(root, ".github", "workflows", "ci.yml");

  if (!existsSync(manifestPath) || !existsSync(workflowPath)) {
    return [];
  }

  const manifest = readPrePushManifest(manifestPath);

  if (manifest === null) {
    return [];
  }

  const workflow = readFileSync(join(root, manifest.ciWorkflow), "utf8");
  const violations: IViolation[] = [];

  for (const command of manifest.requiredCommands) {
    if (!workflow.includes(command)) {
      violations.push({
        file: join(root, manifest.ciWorkflow),
        rule: "pre-push-ci-parity",
        message: `CI workflow is missing pre-push command \`${command}\` (see scripts/ci/pre-push.manifest.json).`,
      });
    }
  }

  return violations;
}

/** pre-push.sh commands must appear in the CI workflow referenced by the manifest. */
export const prePushCiParityRule: IMetaRule = {
  id: "pre-push-ci-parity",
  category: "ci",
  description:
    "CI workflow must include every command listed in scripts/ci/pre-push.manifest.json.",
  run({ root }) {
    return checkPrePushParity(root);
  },
};
