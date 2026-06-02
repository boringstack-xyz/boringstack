import { readFileSync } from "node:fs";

import { parseWorkflow } from "../../parsers/workflow";
import type { IMetaRule, IViolation } from "../../types";

export function checkWorkflowTimeouts(file: string): IViolation[] {
  const violations: IViolation[] = [];
  const { workflow, parseError } = parseWorkflow(readFileSync(file, "utf8"));

  if (workflow === null) {
    violations.push({
      file,
      rule: "github-actions-timeout-required",
      message: `Could not parse YAML: ${parseError ?? "unknown error"}`
    });

    return violations;
  }

  for (const [jobName, job] of Object.entries(workflow.jobs ?? {})) {
    /*
     * Reusable-workflow calls (job-level `uses:`) cannot set
     * timeout-minutes; the called workflow owns its own job timeouts.
     */
    if (typeof job.uses === "string") {
      continue;
    }

    if (job.timeoutMinutes === undefined || job.timeoutMinutes === null) {
      violations.push({
        file,
        rule: "github-actions-timeout-required",
        message: `Job "${jobName}" has no \`timeout-minutes:\` — a hung step runs for GitHub's 6h default and blocks the PR check.`
      });
      continue;
    }

    if (
      typeof job.timeoutMinutes !== "number" ||
      !Number.isFinite(job.timeoutMinutes) ||
      job.timeoutMinutes <= 0
    ) {
      violations.push({
        file,
        rule: "github-actions-timeout-required",
        message: `Job "${jobName}" has a non-numeric or non-positive \`timeout-minutes:\` value.`
      });
    }
  }

  return violations;
}

/**
 * Every runnable workflow job must declare an explicit `timeout-minutes:` so
 * a hang fails fast instead of occupying a runner for GitHub's 6h default.
 */
export const githubActionsTimeoutRequiredRule: IMetaRule = {
  id: "github-actions-timeout-required",
  category: "ci",
  description:
    "GitHub Actions jobs require an explicit timeout-minutes (reusable-workflow calls exempt).",
  run({ workflowFiles }) {
    return workflowFiles.flatMap(checkWorkflowTimeouts);
  }
};
