import { readFileSync } from "node:fs";

import type { IMetaRule, IViolation } from "../../types";

const JOB_KEY_REGEX = /^ {2}([\w-]+):\s*(?:#.*)?$/u;
const TOP_LEVEL_KEY_REGEX = /^\S/u;

interface IJobBlock {
  readonly name: string;
  readonly lines: readonly string[];
}

/*
 * Line-based scan (same pragmatic idiom as github-actions-permissions):
 * collect each `jobs:` child block, then require a job-level
 * `timeout-minutes:` unless the job is a reusable-workflow call
 * (job-level `uses:` — those cannot set timeout-minutes).
 */
function collectJobBlocks(text: string): IJobBlock[] {
  const lines = text.split("\n");
  const blocks: IJobBlock[] = [];
  let inJobs = false;
  let current: { name: string; lines: string[] } | null = null;

  for (const line of lines) {
    if (/^jobs:\s*(?:#.*)?$/u.test(line)) {
      inJobs = true;
      continue;
    }

    if (!inJobs) {
      continue;
    }

    if (TOP_LEVEL_KEY_REGEX.test(line)) {
      inJobs = false;

      if (current !== null) {
        blocks.push(current);
        current = null;
      }

      continue;
    }

    const jobMatch = JOB_KEY_REGEX.exec(line);

    if (jobMatch?.[1] !== undefined) {
      if (current !== null) {
        blocks.push(current);
      }

      current = { name: jobMatch[1], lines: [] };
      continue;
    }

    if (current !== null) {
      current.lines.push(line);
    }
  }

  if (current !== null) {
    blocks.push(current);
  }

  return blocks;
}

export function checkWorkflowTimeouts(file: string): IViolation[] {
  const violations: IViolation[] = [];
  const text = readFileSync(file, "utf8");

  for (const job of collectJobBlocks(text)) {
    const isReusableCall = job.lines.some((line) =>
      /^ {4}uses:\s*\S/u.test(line)
    );

    if (isReusableCall) {
      continue;
    }

    const hasTimeout = job.lines.some((line) =>
      /^ {4}timeout-minutes:\s*[1-9]\d*\s*(?:#.*)?$/u.test(line)
    );

    if (!hasTimeout) {
      violations.push({
        file,
        rule: "github-actions-timeout-required",
        message: `Job "${job.name}" has no job-level \`timeout-minutes:\` — a hung step runs for GitHub's 6h default and blocks the PR check.`,
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
  },
};
