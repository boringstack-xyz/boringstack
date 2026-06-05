import { readFileSync } from "node:fs";

import {
  SHA_REGEX,
  collectPinnedActions,
  parseWorkflow,
  parseWorkflowFile
} from "../../parsers/workflow";
import type { IMetaRule, IViolation } from "../../types";

const ID_TOKEN_WRITE_REGEX = /^[ \t]*id-token:[ \t]*write\b/mu;

/*
 * `id-token: write` only does anything when a step exchanges the OIDC token —
 * keyless signing (cosign/sigstore) or cloud OIDC auth. Granting it with no
 * consumer hands every step in the job a needless token-minting capability.
 * This allowlist names the consumers we recognise; extend it when adding a new
 * OIDC integration so least-privilege stays enforced for template consumers.
 */
const OIDC_CONSUMER_REGEX =
  /cosign|sigstore|configure-aws-credentials|google-github-actions\/auth|azure\/login|vault-action|ACTIONS_ID_TOKEN_REQUEST/iu;

/*
 * Drop YAML comments so a "reserved for future cosign" note can't masquerade
 * as a real OIDC consumer.
 */
function stripYamlComments(text: string): string {
  return text.replace(/(^|[ \t])#.*$/gmu, "");
}

export function checkWorkflow(file: string): IViolation[] {
  const violations: IViolation[] = [];
  const text = readFileSync(file, "utf8");
  const scrubbed = stripYamlComments(text);
  const { workflow, parseError } = parseWorkflow(text);

  if (workflow === null) {
    violations.push({
      file,
      rule: "github-actions-permissions",
      message: `Could not parse YAML: ${parseError ?? "unknown error"}`
    });

    return violations;
  }

  if (workflow.permissions === undefined || workflow.permissions === null) {
    violations.push({
      file,
      rule: "github-actions-permissions",
      message: "Workflow is missing a top-level `permissions:` block."
    });
  }

  if (
    ID_TOKEN_WRITE_REGEX.test(scrubbed) &&
    !OIDC_CONSUMER_REGEX.test(scrubbed)
  ) {
    violations.push({
      file,
      rule: "github-actions-permissions",
      message:
        "`id-token: write` is granted but no OIDC consumer (cosign/sigstore signing or cloud OIDC auth) uses it — drop the permission until a step needs it (least privilege)."
    });
  }

  for (const [jobName, job] of Object.entries(workflow.jobs ?? {})) {
    for (const step of job.steps ?? []) {
      if (typeof step.uses !== "string") {
        continue;
      }

      const uses = step.uses;

      if (uses.startsWith("./")) {
        continue;
      }

      const [actionName, ref] = uses.split("@");

      if (actionName === undefined || ref === undefined) {
        continue;
      }

      if (!SHA_REGEX.test(ref)) {
        violations.push({
          file,
          rule: "github-actions-permissions",
          message: `Job "${jobName}" uses ${actionName}@${ref} — pin to a 40-char commit SHA.`
        });
      }
    }
  }

  return violations;
}

async function verifyActionSha(
  owner: string,
  repo: string,
  sha: string
): Promise<boolean> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;

  if (token !== undefined && token !== "") {
    headers.Authorization = `Bearer ${token}`;
  }

  for (const kind of ["commits", "tags"]) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/${kind}/${sha}`,
        { headers }
      );

      if (response.ok) {
        return true;
      }
    } catch {
      // network glitch — try the other endpoint
    }
  }

  return false;
}

async function verifyFileShas(file: string): Promise<IViolation[]> {
  const workflow = parseWorkflowFile(file);

  if (workflow === null) {
    return [];
  }

  const violations: IViolation[] = [];

  for (const { actionName, owner, repo, ref } of collectPinnedActions(
    workflow
  )) {
    const exists = await verifyActionSha(owner, repo, ref);

    if (!exists) {
      violations.push({
        file,
        rule: "github-actions-permissions:verify",
        message: `${actionName}@${ref} — SHA does not resolve on github.com (typo or unpublished commit).`
      });
    }
  }

  return violations;
}

/**
 * Workflows need a permissions block and SHA-pinned third-party actions.
 * Optional runAsync (--verify) confirms SHAs resolve on github.com.
 */
export const githubActionsPermissionsRule: IMetaRule = {
  id: "github-actions-permissions",
  category: "ci",
  description:
    "GitHub Actions workflows require permissions block and SHA-pinned uses: refs.",
  run({ workflowFiles }) {
    return workflowFiles.flatMap(checkWorkflow);
  },
  async runAsync({ workflowFiles }) {
    const violations: IViolation[] = [];

    for (const file of workflowFiles) {
      violations.push(...(await verifyFileShas(file)));
    }

    return violations;
  }
};
