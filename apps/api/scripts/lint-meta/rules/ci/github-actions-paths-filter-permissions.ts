import { readFileSync } from "node:fs";

import type { IMetaRule, IViolation } from "../../types";

const RULE_ID = "github-actions-paths-filter-permissions";

const PATHS_FILTER_USES_REGEX = /uses:\s*dorny\/paths-filter@/u;
const PERMISSION_LINE_REGEX =
  /^\s*([\w-]+)\s*:\s*(read|write|none)\s*(?:#.*)?$/u;
const INLINE_PERMISSIONS_REGEX = /^\s*permissions:\s*(\S.*?)\s*(?:#.*)?$/u;
const FLOW_ENTRY_REGEX = /([\w-]+)\s*:\s*(read|write|none)/gu;

/*
 * dorny/paths-filter lists PR files through the REST API on pull_request
 * events. That call needs `pull-requests: read`, which a private repository
 * does not grant by default, so the gate dies on its first step with
 * "Resource not accessible by integration". Public repos never show it, which
 * is why template workflows looked fine until a product went private.
 *
 * GitHub resolves permissions per job: a job-level `permissions:` block
 * replaces the workflow-level one entirely (it does not merge), so the rule
 * resolves the effective grant for each job that runs the filter.
 */

type Grants = "all" | ReadonlyMap<string, string>;

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

function isBlankOrComment(line: string): boolean {
  const trimmed = line.trim();

  return trimmed === "" || trimmed.startsWith("#");
}

/*
 * Reads a `permissions:` key whose value is either on the key line (`read-all`,
 * `write-all` or a flow mapping) or a nested block below it.
 */
function parsePermissions(lines: readonly string[], keyIndex: number): Grants {
  const keyLine = lines[keyIndex] ?? "";
  const inline = INLINE_PERMISSIONS_REGEX.exec(keyLine)?.[1];

  if (inline !== undefined) {
    return inline === "read-all" || inline === "write-all"
      ? "all"
      : new Map(
          [...inline.matchAll(FLOW_ENTRY_REGEX)].map((m) => [
            m[1] ?? "",
            m[2] ?? "",
          ])
        );
  }

  const baseIndent = indentOf(keyLine);
  const grants = new Map<string, string>();

  for (let index = keyIndex + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";

    if (isBlankOrComment(line)) {
      continue;
    }

    if (indentOf(line) <= baseIndent) {
      break;
    }

    const entry = PERMISSION_LINE_REGEX.exec(line);

    if (entry !== null) {
      grants.set(entry[1] ?? "", entry[2] ?? "");
    }
  }

  return grants;
}

function grantsPullRequestRead(grants: Grants): boolean {
  if (grants === "all") {
    return true;
  }

  const level = grants.get("pull-requests");

  return level === "read" || level === "write";
}

interface IJobSpan {
  readonly id: string;
  readonly start: number;
  readonly end: number;
}

/*
 * Line-based job split (same idiom as the other github-actions rules): a job
 * key is exactly two spaces under `jobs:`, and a job ends at the next one or at
 * the first top-level key.
 */
function collectJobs(lines: readonly string[]): IJobSpan[] {
  const jobsIndex = lines.findIndex((line) => /^jobs:\s*(?:#.*)?$/u.test(line));

  if (jobsIndex === -1) {
    return [];
  }

  const starts: { id: string; index: number }[] = [];

  for (let index = jobsIndex + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";

    if (/^\S/u.test(line)) {
      break;
    }

    const match = /^ {2}([\w.-]+):\s*(?:#.*)?$/u.exec(line);

    if (match !== null) {
      starts.push({ id: match[1] ?? "", index });
    }
  }

  return starts.map((start, position) => {
    const next = starts[position + 1];
    let end = next?.index ?? lines.length;

    for (let index = start.index + 1; index < end; index += 1) {
      if (/^\S/u.test(lines[index] ?? "")) {
        end = index;
        break;
      }
    }

    return { id: start.id, start: start.index, end };
  });
}

export function checkWorkflowPathsFilterPermissions(
  file: string
): IViolation[] {
  const lines = readFileSync(file, "utf8").split("\n");
  const workflowIndex = lines.findIndex((line) =>
    line.startsWith("permissions:")
  );
  const workflowGrants: Grants =
    workflowIndex === -1 ? new Map() : parsePermissions(lines, workflowIndex);
  const violations: IViolation[] = [];

  for (const job of collectJobs(lines)) {
    const body = lines.slice(job.start, job.end);
    const usesFilter = body.some((line) => PATHS_FILTER_USES_REGEX.test(line));

    if (!usesFilter) {
      continue;
    }

    const jobPermissionIndex = body.findIndex((line) =>
      /^ {4}permissions:/u.test(line)
    );
    const effective =
      jobPermissionIndex === -1
        ? workflowGrants
        : parsePermissions(lines, job.start + jobPermissionIndex);

    if (!grantsPullRequestRead(effective)) {
      violations.push({
        file,
        rule: RULE_ID,
        message: `job '${job.id}' runs dorny/paths-filter but its effective permissions do not grant \`pull-requests: read\`. On pull_request events the filter reads PR files through the REST API, which fails with "Resource not accessible by integration" in private repositories. Add it to the job's permissions block (or the workflow's, when the job has none).`,
      });
    }
  }

  return violations;
}

/**
 * paths-filter needs `pull-requests: read` on pull_request events; without it
 * every PR check dies on step one in a private repository while main stays green.
 */
export const githubActionsPathsFilterPermissionsRule: IMetaRule = {
  id: RULE_ID,
  category: "ci",
  description:
    "Jobs running dorny/paths-filter must have pull-requests: read in effect (job-level or workflow-level), or PR checks fail in private repositories.",
  run({ workflowFiles }) {
    return workflowFiles.flatMap(checkWorkflowPathsFilterPermissions);
  },
};
