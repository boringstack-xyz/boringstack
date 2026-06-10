import { readFileSync } from "node:fs";
import { basename } from "node:path";

import type { IMetaRule, IViolation } from "../../types";

const TOP_LEVEL_KEY_REGEX = /^\S/u;
const SECURITY_WORKFLOW_REGEX = /-security-(?:sast|secrets|deps)\.ya?ml$/u;

/*
 * Security scans (SAST, secret, dependency) must run to completion for every
 * pushed ref. With `cancel-in-progress: true`, a follow-up push cancels the
 * in-flight scan — the superseded commit is then neither passed nor failed,
 * and a PR can read green over code that was never actually scanned. So any
 * `*-security-{sast,secrets,deps}` workflow's concurrency block must set
 * `cancel-in-progress: false`. Build/validate workflows are intentionally
 * exempt: there, cancelling superseded runs is the desirable fast-feedback
 * behaviour.
 */
export function checkWorkflowSecurityNoCancel(file: string): IViolation[] {
  if (!SECURITY_WORKFLOW_REGEX.test(basename(file))) {
    return [];
  }

  const lines = readFileSync(file, "utf8").split("\n");
  let inConcurrency = false;
  let cancelInProgress: boolean | null = null;

  for (const line of lines) {
    if (/^concurrency:\s*(?:#.*)?$/u.test(line)) {
      inConcurrency = true;
      continue;
    }

    if (!inConcurrency) {
      continue;
    }

    if (TOP_LEVEL_KEY_REGEX.test(line)) {
      inConcurrency = false;
      continue;
    }

    const match = /^\s+cancel-in-progress:\s*(true|false)\s*(?:#.*)?$/u.exec(
      line
    );

    if (match !== null) {
      cancelInProgress = match[1] === "true";
    }
  }

  if (cancelInProgress === true) {
    return [
      {
        file,
        rule: "github-actions-security-no-cancel",
        message:
          "Security scan workflow sets `cancel-in-progress: true` — a follow-up push cancels the in-flight scan and the superseded commit goes unscanned. Set `cancel-in-progress: false` so every pushed ref is scanned to completion.",
      },
    ];
  }

  return [];
}

/**
 * A cancelled security scan is neither a pass nor a fail, and the scanned
 * commit may never be re-scanned. Security workflows must queue, not cancel.
 */
export const githubActionsSecurityNoCancelRule: IMetaRule = {
  id: "github-actions-security-no-cancel",
  category: "ci",
  description:
    "Security scan workflows (*-security-{sast,secrets,deps}) must set concurrency cancel-in-progress: false so no pushed ref goes unscanned.",
  run({ workflowFiles }) {
    return workflowFiles.flatMap(checkWorkflowSecurityNoCancel);
  },
};
