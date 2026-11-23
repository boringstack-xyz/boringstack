/*
 * The triage lane's inputs and outputs. The input is the findings ledger
 * (tools/factory/fleet, `bun run factory findings`): unfiled, unmuted error
 * groups, a few per run. The output is a plan written by the agent, which
 * says for each finding whether it is a code fix (a PR), an operations cause
 * (a person), noise or unknown. Adapted from an earlier agent triage plan,
 * keyed by finding id instead of issue number.
 */
import { type ILedger, unfiledFindings } from "../fleet/findings.utils";
import { isRecord } from "../state";

/** Findings one triage run takes. */
export const TRIAGE_BATCH = 3;

/** GitHub caps a workflow_dispatch input well below this; a larger batch is cut down. */
const MAX_INPUT_CHARS = 60_000;

export interface ITriageFinding {
  readonly id: string;
  readonly service: string;
  readonly signature: string;
  readonly count: number;
  readonly example: string;
  readonly filed: string | null;
}

export type Outcome = "fix" | "ops" | "noise" | "unknown";

const OUTCOMES: readonly Outcome[] = ["fix", "ops", "noise", "unknown"];

export const isOutcome = (value: unknown): value is Outcome =>
  OUTCOMES.some((outcome) => outcome === value);

/** The next findings to triage: unmuted, without an issue, most frequent first. */
export const triageBatch = (
  ledger: ILedger,
  limit: number = TRIAGE_BATCH
): ITriageFinding[] =>
  unfiledFindings(ledger)
    .slice(0, limit)
    .map((finding) => ({
      id: finding.id,
      service: finding.service,
      signature: finding.signature,
      count: finding.count,
      example: finding.example,
      filed: finding.filed?.url ?? null,
    }));

/** The workflow_dispatch input: the batch as JSON, cut down until it fits. */
export const dispatchInput = (batch: readonly ITriageFinding[]): string => {
  let rows = [...batch];
  let text = JSON.stringify(rows);

  while (text.length > MAX_INPUT_CHARS && rows.length > 1) {
    rows = rows.slice(0, -1);
    text = JSON.stringify(rows);
  }

  return text;
};

/** The findings the workflow was given, validated. A string is the reason it is not usable. */
export const parseTriageInput = (raw: string): ITriageFinding[] | string => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return "The findings input is not JSON.";
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return "The findings input is an empty list.";
  }

  const rows = parsed.filter(
    (row): row is ITriageFinding =>
      isRecord(row) &&
      typeof row.id === "string" &&
      typeof row.service === "string" &&
      typeof row.signature === "string" &&
      typeof row.count === "number" &&
      typeof row.example === "string" &&
      (row.filed === null || typeof row.filed === "string")
  );

  return rows.length === parsed.length
    ? rows
    : "Some findings in the input are malformed.";
};

export interface ITriageItem {
  readonly finding: string;
  readonly problem: string;
  readonly cause: string;
  readonly outcome: Outcome;
  readonly action: string | undefined;
}

export interface ITriagePlan {
  readonly items: readonly ITriageItem[];
  readonly fix: {
    readonly slug: string;
    readonly title: string;
    /** Finding ids this PR addresses; each must have outcome fix. */
    readonly items: readonly string[];
  } | null;
}

const SLUG = /^[a-z0-9-]{3,60}$/u;

/** What is wrong with a plan, in plain lines. Empty when the plan can be acted on. */
export const planProblems = (
  plan: unknown,
  findingIds: readonly string[]
): string[] => {
  if (
    !isRecord(plan) ||
    !Array.isArray(plan.items) ||
    plan.items.length === 0
  ) {
    return ["items is empty"];
  }

  const problems: string[] = [];
  const seen = new Set<string>();
  const fixIds = new Set<string>();

  plan.items.forEach((raw: unknown, index: number) => {
    if (!isRecord(raw)) {
      problems.push(`item ${String(index)} is not an object`);

      return;
    }

    const finding = typeof raw.finding === "string" ? raw.finding : "";

    if (!findingIds.includes(finding)) {
      problems.push(`item ${String(index)} names no finding in this run`);
    }

    if (seen.has(finding)) {
      problems.push(`finding ${finding} is in the plan twice`);
    }

    seen.add(finding);

    if (typeof raw.problem !== "string" || raw.problem === "") {
      problems.push(`item ${String(index)} has no problem`);
    }

    if (!isOutcome(raw.outcome)) {
      problems.push(`item ${String(index)} has outcome ${String(raw.outcome)}`);
    }

    if (raw.outcome === "fix") {
      fixIds.add(finding);
    }

    if (
      raw.outcome === "ops" &&
      (typeof raw.action !== "string" || raw.action === "")
    ) {
      problems.push(`item ${String(index)} is ops with no action for a person`);
    }
  });

  for (const id of findingIds) {
    if (!seen.has(id)) {
      problems.push(`finding ${id} has no item`);
    }
  }

  const fix = plan.fix;

  if (isRecord(fix)) {
    if (typeof fix.slug !== "string" || !SLUG.test(fix.slug)) {
      problems.push("fix.slug must be lowercase-hyphenated");
    }

    if (typeof fix.title !== "string" || fix.title === "") {
      problems.push("fix.title is empty");
    }

    const addressed: unknown[] = Array.isArray(fix.items) ? fix.items : [];

    if (addressed.length === 0) {
      problems.push("fix is set but names no finding");
    }

    for (const id of addressed) {
      if (typeof id !== "string" || !fixIds.has(id)) {
        problems.push(`fix addresses ${String(id)}, which has no outcome fix`);
      }
    }
  } else if (fixIds.size > 0) {
    problems.push("an item has outcome fix but there is no fix");
  }

  return problems;
};

/** A plan as typed data, or the problems that stop it being acted on. */
export const readPlan = (
  raw: unknown,
  findingIds: readonly string[]
): ITriagePlan | string[] => {
  const problems = planProblems(raw, findingIds);

  if (problems.length > 0 || !isRecord(raw) || !Array.isArray(raw.items)) {
    return problems;
  }

  const items = raw.items.filter(isRecord).map((item): ITriageItem => ({
    finding: typeof item.finding === "string" ? item.finding : "",
    problem: typeof item.problem === "string" ? item.problem : "",
    cause: typeof item.cause === "string" ? item.cause : "",
    outcome: isOutcome(item.outcome) ? item.outcome : "unknown",
    action: typeof item.action === "string" ? item.action : undefined,
  }));
  const fix = isRecord(raw.fix) ? raw.fix : undefined;

  return {
    items,
    fix:
      fix === undefined
        ? null
        : {
            slug: typeof fix.slug === "string" ? fix.slug : "",
            title: typeof fix.title === "string" ? fix.title : "",
            items: Array.isArray(fix.items)
              ? fix.items.filter((id): id is string => typeof id === "string")
              : [],
          },
  };
};

const cell = (text: string | undefined): string =>
  (text ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");

const LABEL: Record<Outcome, string> = {
  fix: "code fix",
  ops: "needs a person (infrastructure or operations)",
  noise: "no change needed",
  unknown: "cause not found yet",
};

/** The comment the triage run leaves: one row per finding, and what happens next. */
export const triageComment = (
  plan: ITriagePlan,
  input: { readonly prUrl: string | undefined; readonly proven: boolean }
): string => {
  const rows = plan.items.map((item) => {
    const outcome =
      item.outcome === "fix"
        ? input.prUrl === undefined
          ? "fix attempted, PR not opened"
          : `fix PR ${input.prUrl}${input.proven ? " (proven by its test)" : " (not proven; a person reviews it)"}`
        : LABEL[item.outcome];

    return `| ${cell(item.problem)} | ${cell(item.cause)} | ${cell(outcome)} | ${cell(item.action)} |`;
  });
  const needsHuman = plan.items.some(
    (item) => item.outcome === "ops" || item.outcome === "unknown"
  );

  return [
    "Triage agent:",
    "",
    "| Problem | Root cause | Outcome | What to change |",
    "| --- | --- | --- | --- |",
    ...rows,
    "",
    needsHuman
      ? "Some causes need a person (infrastructure, operations, or not found yet). Read the rows marked so."
      : "",
  ]
    .filter((line, index, all) => line !== "" || all[index - 1] !== "")
    .join("\n")
    .trimEnd();
};
