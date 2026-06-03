import { readFileSync } from "node:fs";

import type { IMetaRule, IViolation } from "../../types";

const TOP_LEVEL_KEY_REGEX = /^\S/u;

/*
 * Line-based scan (same pragmatic idiom as github-actions-timeout-required):
 * when a workflow declares a top-level `concurrency:` block, require an
 * explicit `cancel-in-progress:` so the queue-or-cancel decision is a
 * visible choice instead of GitHub's implicit default.
 */
export function checkWorkflowConcurrencyExplicit(file: string): IViolation[] {
  const lines = readFileSync(file, "utf8").split("\n");
  let inConcurrency = false;
  let sawConcurrency = false;
  let hasCancelKey = false;

  for (const line of lines) {
    if (/^concurrency:\s*(?:#.*)?$/u.test(line)) {
      inConcurrency = true;
      sawConcurrency = true;
      continue;
    }

    if (!inConcurrency) {
      continue;
    }

    if (TOP_LEVEL_KEY_REGEX.test(line)) {
      inConcurrency = false;
      continue;
    }

    if (/^\s+cancel-in-progress:\s*(?:true|false)\s*(?:#.*)?$/u.test(line)) {
      hasCancelKey = true;
    }
  }

  if (sawConcurrency && !hasCancelKey) {
    return [
      {
        file,
        rule: "github-actions-concurrency-explicit",
        message:
          "Workflow declares `concurrency:` without an explicit `cancel-in-progress:` — state the queue-or-cancel choice instead of relying on GitHub's implicit default."
      }
    ];
  }

  return [];
}

/**
 * A `concurrency:` block without `cancel-in-progress:` silently inherits
 * GitHub's default and reads as an oversight; sibling workflows then drift.
 */
export const githubActionsConcurrencyExplicitRule: IMetaRule = {
  id: "github-actions-concurrency-explicit",
  category: "ci",
  description:
    "Workflows with a concurrency block must set cancel-in-progress explicitly.",
  run({ workflowFiles }) {
    return workflowFiles.flatMap(checkWorkflowConcurrencyExplicit);
  }
};
