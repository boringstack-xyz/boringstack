import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";

import { getErrorMessage } from "../../../src/lib/errors/getErrorMessage";

export const SHA_REGEX = /^[0-9a-f]{40}$/;

export interface IWorkflowStep {
  readonly uses?: string;
}

export interface IWorkflowJob {
  readonly steps?: IWorkflowStep[];
}

export interface IWorkflow {
  readonly permissions?: unknown;
  readonly jobs?: Record<string, IWorkflowJob>;
}

function toWorkflowStep(value: unknown): IWorkflowStep | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  let uses: string | undefined;

  for (const [k, v] of Object.entries(value)) {
    if (k === "uses" && typeof v === "string") {
      uses = v;
    }
  }

  return { uses };
}

function toWorkflowJob(value: unknown): IWorkflowJob | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  let steps: IWorkflowStep[] | undefined;

  for (const [k, v] of Object.entries(value)) {
    if (k !== "steps" || !Array.isArray(v)) {
      continue;
    }

    const collected: IWorkflowStep[] = [];

    for (const item of v) {
      const step = toWorkflowStep(item);

      if (step !== undefined) {
        collected.push(step);
      }
    }

    steps = collected;
  }

  return { steps };
}

function toWorkflowJobs(
  value: unknown
): Record<string, IWorkflowJob> | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const out: Record<string, IWorkflowJob> = {};

  for (const [name, jobUnknown] of Object.entries(value)) {
    const job = toWorkflowJob(jobUnknown);

    if (job !== undefined) {
      out[name] = job;
    }
  }

  return out;
}

export interface IParsedWorkflow {
  readonly workflow: IWorkflow | null;
  readonly parseError: string | null;
}

export function parseWorkflow(text: string): IParsedWorkflow {
  let raw: unknown;

  try {
    raw = parseYaml(text);
  } catch (error) {
    return { workflow: null, parseError: getErrorMessage(error) };
  }

  if (typeof raw !== "object" || raw === null) {
    return {
      workflow: null,
      parseError: "Top-level YAML value is not a mapping."
    };
  }

  let permissions: unknown;
  let jobs: Record<string, IWorkflowJob> | undefined;

  for (const [key, value] of Object.entries(raw)) {
    if (key === "permissions") {
      permissions = value;
    } else if (key === "jobs") {
      jobs = toWorkflowJobs(value);
    }
  }

  return { workflow: { permissions, jobs }, parseError: null };
}

export interface IPinnedAction {
  readonly actionName: string;
  readonly owner: string;
  readonly repo: string;
  readonly ref: string;
}

export function parsePinnedAction(uses: string): IPinnedAction | null {
  if (uses.startsWith("./")) {
    return null;
  }

  const [actionName, ref] = uses.split("@");

  if (actionName === undefined || ref === undefined) {
    return null;
  }

  if (!SHA_REGEX.test(ref)) {
    return null;
  }

  const [owner, repo] = actionName.split("/");

  if (owner === undefined || repo === undefined) {
    return null;
  }

  return { actionName, owner, repo, ref };
}

export function collectPinnedActions(workflow: IWorkflow): IPinnedAction[] {
  const actions: IPinnedAction[] = [];

  for (const job of Object.values(workflow.jobs ?? {})) {
    for (const step of job.steps ?? []) {
      if (typeof step.uses !== "string") {
        continue;
      }

      const parsed = parsePinnedAction(step.uses);

      if (parsed !== null) {
        actions.push(parsed);
      }
    }
  }

  return actions;
}

export function parseWorkflowFile(file: string): IWorkflow | null {
  return parseWorkflow(readFileSync(file, "utf8")).workflow;
}
