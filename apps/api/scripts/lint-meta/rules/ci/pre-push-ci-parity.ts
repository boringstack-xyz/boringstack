import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

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

/*
 * The CI workflow lives at the app root when this template is a standalone
 * repo, but in a monorepo checkout it lives at the repository root. Walk up
 * from the app root to the nearest directory containing the manifest's
 * ciWorkflow path so the rule always compares against the workflow that
 * actually runs for this code instead of silently no-oping.
 */
function resolveCiWorkflow(root: string, ciWorkflow: string): string | null {
  let current = root;

  for (;;) {
    const candidate = join(current, ciWorkflow);

    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = dirname(current);

    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

export function checkPrePushParity(root: string): IViolation[] {
  const manifestPath = join(root, PRE_PUSH_MANIFEST);

  // No manifest means the consumer deliberately opted out of pre-push parity.
  if (!existsSync(manifestPath)) {
    return [];
  }

  const manifest = readPrePushManifest(manifestPath);

  // A present-but-malformed manifest must fail, not silently skip the check.
  if (manifest === null) {
    return [
      {
        file: manifestPath,
        rule: "pre-push-ci-parity",
        message:
          "Pre-push manifest is malformed — expected `{ ciWorkflow: string, requiredCommands: string[] }`.",
      },
    ];
  }

  const workflowPath = resolveCiWorkflow(root, manifest.ciWorkflow);

  // An unresolvable workflow means the parity check never ran — fail closed.
  if (workflowPath === null) {
    return [
      {
        file: manifestPath,
        rule: "pre-push-ci-parity",
        message: `CI workflow \`${manifest.ciWorkflow}\` not found from the app root upward — fix \`ciWorkflow\` in scripts/ci/pre-push.manifest.json.`,
      },
    ];
  }

  const workflow = readFileSync(workflowPath, "utf8");
  const violations: IViolation[] = [];

  for (const command of manifest.requiredCommands) {
    if (!workflow.includes(command)) {
      violations.push({
        file: workflowPath,
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
