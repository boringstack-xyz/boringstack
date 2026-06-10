import { readFileSync } from "node:fs";

import type { IMetaRule, IViolation } from "../../types";

const RULE_ID = "github-actions-runner-pinned";

const RUNS_ON_REGEX = /^\s*runs-on:\s*(?<label>\S+)\s*(?:#.*)?$/u;

/*
 * `ubuntu-latest` floats on GitHub's migration schedule: preinstalled
 * tool versions and OS packages change with no commit to blame, so CI
 * behavior (scanners, compose, system deps) can differ between two runs
 * of the same SHA. Everything else in this repo is exact-pinned — deps,
 * action SHAs, scanner versions, bun — so runner images get the same
 * bar: name an explicit OS version (e.g. ubuntu-24.04). Expression
 * labels (matrix strategies) are out of scope for a line scan.
 */
export function checkWorkflowRunnerPinned(file: string): IViolation[] {
  const violations: IViolation[] = [];
  const lines = readFileSync(file, "utf8").split("\n");

  for (const line of lines) {
    const label = RUNS_ON_REGEX.exec(line)?.groups?.label;

    if (label === undefined || label.startsWith("$")) {
      continue;
    }

    if (label.replace(/["']/gu, "").endsWith("-latest")) {
      violations.push({
        file,
        rule: RULE_ID,
        message: `runs-on: ${label} floats with GitHub's runner image migrations — tool versions change between runs with no repo diff. Pin an explicit OS version (e.g. ubuntu-24.04).`,
      });
    }
  }

  return violations;
}

/**
 * A floating `*-latest` runner image changes underneath CI on GitHub's
 * schedule; pin the OS version like every other version in this repo.
 */
export const githubActionsRunnerPinnedRule: IMetaRule = {
  id: RULE_ID,
  category: "ci",
  description:
    "Workflows must pin runner images to an explicit OS version instead of floating *-latest labels.",
  run({ workflowFiles }) {
    return workflowFiles.flatMap(checkWorkflowRunnerPinned);
  },
};
