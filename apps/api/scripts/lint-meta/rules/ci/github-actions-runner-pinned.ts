import { readFileSync } from "node:fs";

import type { IMetaRule, IViolation } from "../../types";

const RULE_ID = "github-actions-runner-pinned";

const RUNS_ON_REGEX = /^\s*runs-on:\s*(?<label>\S+)\s*(?:#.*)?$/u;
const FORK_GUARD = "!github.event.pull_request.head.repo.fork";

/*
 * `ubuntu-latest` floats on GitHub's migration schedule: preinstalled
 * tool versions and OS packages change with no commit to blame, so CI
 * behavior (scanners, compose, system deps) can differ between two runs
 * of the same SHA. Everything else in this repo is exact-pinned: deps,
 * action SHAs, scanner versions, bun, so runner images get the same
 * bar: name an explicit OS version (e.g. ubuntu-24.04). Expression
 * labels (matrix strategies) are out of scope for a line scan.
 *
 * The one expression that is checked is the self-hosted runner switch.
 * `vars.CI_RUNNER` moves jobs onto the operator's own machines, and a
 * pull request from a fork must never run there, so every use must
 * carry the fork guard and fall back to a pinned hosted image.
 */
export function checkWorkflowRunnerPinned(file: string): IViolation[] {
  const violations: IViolation[] = [];
  const lines = readFileSync(file, "utf8").split("\n");

  for (const line of lines) {
    if (
      /^\s*runs-on:/u.test(line) &&
      line.includes("vars.CI_RUNNER") &&
      !line.includes(FORK_GUARD)
    ) {
      violations.push({
        file,
        rule: RULE_ID,
        message: `runs-on uses vars.CI_RUNNER without the fork guard: pull requests from forks would run on self-hosted runners. Use \${{ ${FORK_GUARD} && vars.CI_RUNNER || 'ubuntu-24.04' }}.`,
      });
      continue;
    }

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
    "Workflows must pin runner images to an explicit OS version instead of floating *-latest labels, and guard vars.CI_RUNNER against fork pull requests.",
  run({ workflowFiles }) {
    return workflowFiles.flatMap(checkWorkflowRunnerPinned);
  },
};
