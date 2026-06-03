import { readFileSync } from "node:fs";

import type { IMetaRule, IViolation } from "../../types";

/*
 * Every `bun install` in CI re-downloads the dependency tree unless
 * ~/.bun/install/cache is restored — 30-90s wasted per run, multiplied
 * across workflows and pushes. One workflow carried the cache step and
 * seven didn't; this pins the convention: bun install ⇒ actions/cache.
 */
export function checkWorkflowBunCache(file: string): IViolation[] {
  const text = readFileSync(file, "utf8");

  if (!text.includes("bun install")) {
    return [];
  }

  if (text.includes("actions/cache@")) {
    return [];
  }

  return [
    {
      file,
      rule: "github-actions-bun-cache",
      message:
        "Workflow runs `bun install` without an actions/cache step for ~/.bun/install/cache — copy the cache block from apps-api-ci.yml (keyed on the relevant bun.lock files).",
    },
  ];
}

/** bun install in a workflow requires a bun cache step. */
export const githubActionsBunCacheRule: IMetaRule = {
  id: "github-actions-bun-cache",
  category: "ci",
  description: "Workflows running bun install must cache ~/.bun/install/cache.",
  run({ workflowFiles }) {
    return workflowFiles.flatMap(checkWorkflowBunCache);
  },
};
