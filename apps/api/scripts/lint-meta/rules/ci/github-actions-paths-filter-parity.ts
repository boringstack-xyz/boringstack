import { readFileSync } from "node:fs";

import type { IMetaRule, IViolation } from "../../types";

const RULE_ID = "github-actions-paths-filter-parity";

/*
 * Workflows that pair a `push.paths` trigger with an in-job
 * dorny/paths-filter gate (PR triggers stay unfiltered so branch
 * protection always gets a status) have two lists describing the same
 * intent. When they drift, one of two silent failure modes appears:
 *
 *   - a push path no filter entry covers: pushes start the workflow but
 *     every gated step no-ops, so the change lands unverified;
 *   - a filter entry no push path covers: the gated work runs on PRs but
 *     never on direct pushes to main.
 *
 * Coverage is glob-aware in the only form these workflows use: an exact
 * match, or a `<prefix>/**` entry covering anything under that prefix.
 */
function covers(glob: string, target: string): boolean {
  if (glob === target || glob === "**") {
    return true;
  }

  if (glob.endsWith("/**")) {
    const prefix = glob.slice(0, -3);

    return target === prefix || target.startsWith(`${prefix}/`);
  }

  return false;
}

function coveredByAny(globs: readonly string[], target: string): boolean {
  return globs.some((glob) => covers(glob, target));
}

const LIST_ENTRY_REGEX = /^\s+- ["']([^"']+)["']\s*$/u;
const FILTER_GROUP_KEY_REGEX = /^\s+[\w-]+:\s*$/u;

function isListInterruption(line: string): boolean {
  return line.trim() !== "" && !line.trim().startsWith("#");
}

export function collectPushPaths(lines: readonly string[]): string[] {
  const pushPaths: string[] = [];
  let inPush = false;
  let inPaths = false;

  for (const line of lines) {
    if (/^\S/u.test(line) || (inPush && /^ {2}\w/u.test(line))) {
      inPush = false;
      inPaths = false;
    }

    if (/^ {2}push:\s*(?:#.*)?$/u.test(line)) {
      inPush = true;
      continue;
    }

    if (inPush && /^\s+paths:\s*(?:#.*)?$/u.test(line)) {
      inPaths = true;
      continue;
    }

    if (!inPush || !inPaths) {
      continue;
    }

    const entry = LIST_ENTRY_REGEX.exec(line)?.[1];

    if (entry !== undefined) {
      pushPaths.push(entry);
    } else if (isListInterruption(line)) {
      inPaths = false;
    }
  }

  return pushPaths;
}

export function collectFilterEntries(lines: readonly string[]): string[] {
  const filterPaths: string[] = [];
  let inFilters = false;

  for (const line of lines) {
    if (/^\s+filters: \|\s*$/u.test(line)) {
      inFilters = true;
      continue;
    }

    if (!inFilters) {
      continue;
    }

    const entry = LIST_ENTRY_REGEX.exec(line)?.[1];

    if (entry !== undefined) {
      filterPaths.push(entry);
    } else if (!FILTER_GROUP_KEY_REGEX.test(line) && isListInterruption(line)) {
      inFilters = false;
    }
  }

  return filterPaths;
}

export function checkWorkflowPathsFilterParity(file: string): IViolation[] {
  const lines = readFileSync(file, "utf8").split("\n");
  const pushPaths = collectPushPaths(lines);
  const filterPaths = [...new Set(collectFilterEntries(lines))];

  /*
   * The rule only relates the two lists; a workflow with one or neither
   * (push-only triggers, PR-only filter gating) has nothing to compare.
   * Negated filter entries invert coverage semantics this scan cannot
   * model, so bail rather than report on guesses.
   */
  if (
    pushPaths.length === 0 ||
    filterPaths.length === 0 ||
    filterPaths.some((entry) => entry.startsWith("!"))
  ) {
    return [];
  }

  const pushOnly = pushPaths.filter(
    (pushPath) => !coveredByAny(filterPaths, pushPath)
  );
  const filterOnly = filterPaths.filter(
    (filterPath) => !coveredByAny(pushPaths, filterPath)
  );

  return [
    ...pushOnly.map((pushPath) => ({
      file,
      rule: RULE_ID,
      message: `push trigger path '${pushPath}' is not covered by any paths-filter entry — pushes touching it start the workflow but every filter-gated step no-ops, so the change lands unverified. Add it to a filter block (or drop it from push.paths).`,
    })),
    ...filterOnly.map((filterPath) => ({
      file,
      rule: RULE_ID,
      message: `paths-filter entry '${filterPath}' is not covered by push.paths — the work it gates runs on PRs but never on direct pushes to main. Add a covering push trigger path (or drop the filter entry).`,
    })),
  ];
}

/**
 * push.paths and the in-job dorny/paths-filter lists describe the same
 * intent; when they drift, changes either land unverified (push-only
 * path → all gated steps no-op) or skip main-branch validation entirely
 * (filter-only path → workflow never starts on push).
 */
export const githubActionsPathsFilterParityRule: IMetaRule = {
  id: RULE_ID,
  category: "ci",
  description:
    "Workflows pairing push.paths with a dorny/paths-filter gate must keep the two path sets mutually covered.",
  run({ workflowFiles }) {
    return workflowFiles.flatMap(checkWorkflowPathsFilterParity);
  },
};
