import { readFileSync } from "node:fs";

import type { IMetaRule, IViolation } from "../../types";

const SHA_REGEX = /^[0-9a-f]{40}$/u;

export function checkWorkflowShas(file: string): IViolation[] {
  const violations: IViolation[] = [];
  const text = readFileSync(file, "utf8");

  if (!/^permissions\s*:/mu.test(text)) {
    violations.push({
      file,
      rule: "github-actions-permissions",
      message: "Workflow is missing a top-level `permissions:` block.",
    });
  }

  const usesRegex = /^\s*-?\s*uses:\s*([^\s#]+)/gmu;
  let match: RegExpExecArray | null = usesRegex.exec(text);

  while (match !== null) {
    const ref = match[1];

    if (ref === undefined || ref.startsWith("./")) {
      match = usesRegex.exec(text);
      continue;
    }

    const [actionName, sha] = ref.split("@");

    if (actionName === undefined || sha === undefined) {
      match = usesRegex.exec(text);
      continue;
    }

    if (!SHA_REGEX.test(sha)) {
      violations.push({
        file,
        rule: "github-actions-permissions",
        message: `${actionName}@${sha} — pin to a 40-char commit SHA.`,
      });
    }

    match = usesRegex.exec(text);
  }

  return violations;
}

function collectPinnedActions(
  text: string
): readonly { actionName: string; owner: string; repo: string; ref: string }[] {
  const out: {
    actionName: string;
    owner: string;
    repo: string;
    ref: string;
  }[] = [];
  const usesRegex = /^\s*-?\s*uses:\s*([^\s#]+)/gmu;
  let match: RegExpExecArray | null = usesRegex.exec(text);

  while (match !== null) {
    const ref = match[1];

    if (ref === undefined || ref.startsWith("./")) {
      match = usesRegex.exec(text);
      continue;
    }

    const atIndex = ref.lastIndexOf("@");

    if (atIndex <= 0) {
      match = usesRegex.exec(text);
      continue;
    }

    const actionName = ref.slice(0, atIndex);
    const sha = ref.slice(atIndex + 1);
    const slashIndex = actionName.indexOf("/");

    if (slashIndex <= 0) {
      match = usesRegex.exec(text);
      continue;
    }

    const owner = actionName.slice(0, slashIndex);
    const repo = actionName.slice(slashIndex + 1);

    if (SHA_REGEX.test(sha)) {
      out.push({ actionName, owner, repo, ref: sha });
    }

    match = usesRegex.exec(text);
  }

  return out;
}

async function verifyActionSha(
  owner: string,
  repo: string,
  sha: string
): Promise<boolean> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
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
  const text = readFileSync(file, "utf8");
  const violations: IViolation[] = [];

  for (const { actionName, owner, repo, ref } of collectPinnedActions(text)) {
    const exists = await verifyActionSha(owner, repo, ref);

    if (!exists) {
      violations.push({
        file,
        rule: "github-actions-permissions:verify",
        message: `${actionName}@${ref} — SHA does not resolve on github.com (typo or unpublished commit).`,
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
    return workflowFiles.flatMap(checkWorkflowShas);
  },
  async runAsync({ workflowFiles }) {
    const violations: IViolation[] = [];

    for (const file of workflowFiles) {
      violations.push(...(await verifyFileShas(file)));
    }

    return violations;
  },
};
