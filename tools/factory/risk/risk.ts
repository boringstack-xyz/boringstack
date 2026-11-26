/*
 * The risk of a pull request: low, medium or high. It decides who merges.
 *
 * Three readings meet, and the highest wins, so nobody can talk a change down:
 *   - the floor the changed paths set (a workflow, a migration, sign-in or
 *     billing code is high whatever anyone writes);
 *   - the level the author's verification record names;
 *   - the level the independent reviewer names.
 *
 * Agents merge a reviewed pull request whose level is at or below the
 * repository's ceiling (`AGENT_MERGE_MAX_RISK`, medium by default). Above it,
 * a person merges.
 */
import { PROTECTED, TEST_FILE } from "../lanes/lanes";

export const RISK_ORDER = ["low", "medium", "high"] as const;

export type Risk = (typeof RISK_ORDER)[number];

/** What each level means, and who merges it with the default ceiling. */
export const RISK_MEANING: Readonly<Record<Risk, string>> = {
  low: "Docs, copy, styling, tests or a refactor that changes no behaviour. An agent merges it after the independent review approves.",
  medium:
    "Behaviour in the app or the API that writes no stored data and touches no permissions. An agent merges it after the independent review approves.",
  high: "Stored data (migrations, queues), sign-in, permissions, billing, secrets, emails to customers, infrastructure, CI, release or the factory itself. A person reviews and merges it.",
};

export const isRisk = (value: string): value is Risk =>
  RISK_ORDER.some((level) => level === value);

const rank = (risk: Risk): number => RISK_ORDER.indexOf(risk);

/** The highest of the given levels; low when none is given. */
export const highest = (...levels: readonly Risk[]): Risk =>
  levels.reduce<Risk>(
    (top, level) => (rank(level) > rank(top) ? level : top),
    "low"
  );

/** Paths that make a change high on their own: what no lane may touch, and more. */
export const HIGH_PATHS: readonly RegExp[] = [
  ...PROTECTED,
  /^apps\/api\/src\/config\/security\//u,
  /^apps\/api\/src\/lib\/(acl|audit-log|campaigns|cookies|crypto|email|jwt|oauth|password|postgres|synthetic|tokens)\//u,
  /^apps\/api\/src\/queues\//u,
  /^apps\/api\/src\/clients\/postgres\//u,
  /^apps\/api\/src\/middleware\/(admin-request-guard|require-)/u,
  /^apps\/api\/src\/templates\//u,
  /^apps\/api\/src\/api\/(admin|webhooks|users)\//u,
  /^apps\/admin\//u,
  /^scripts\/(deps|release|ci)\//u,
  /(^|\/)\.env(\.[a-z]+)?$/u,
];

/** Paths that cannot change behaviour: docs and tests. Everything else is at least medium. */
export const LOW_PATHS: readonly RegExp[] = [
  /\.mdx?$/u,
  /^apps\/docs\//u,
  /^docs\//u,
  /\.stories\.tsx?$/u,
  /^apps\/ui\/e2e\//u,
  TEST_FILE,
];

/** The level one path sets on its own. */
export const pathRisk = (path: string): Risk => {
  if (HIGH_PATHS.some((pattern) => pattern.test(path))) {
    return "high";
  }

  return LOW_PATHS.some((pattern) => pattern.test(path)) ? "low" : "medium";
};

/** The level the changed paths set: the highest any one of them reaches. */
export const pathFloor = (paths: readonly string[]): Risk =>
  highest(...paths.map(pathRisk));

/**
 * The level a record or review names. Reads the first `Risk: <level>` line,
 * or the record's `## Risk` section ("medium: why"). The older kinds of
 * change are read as levels: ui is low, logic medium, data and auth-billing high.
 */
const LEGACY: Readonly<Record<string, Risk>> = {
  ui: "low",
  logic: "medium",
  data: "high",
  "auth-billing": "high",
};

const levelWord = (text: string): Risk | undefined => {
  const word = text.trim().toLowerCase();

  return isRisk(word) ? word : LEGACY[word];
};

export const namedRisk = (text: string): Risk | undefined => {
  const line = /^\**Risk:\s*([a-z-]+)/imu.exec(text);

  if (line?.[1] !== undefined) {
    return levelWord(line[1]);
  }

  const lines = text.split("\n");
  const start = lines.findIndex((entry) => /^#{2,3} Risk\s*$/u.test(entry));
  const first = lines.slice(start + 1).find((entry) => entry.trim() !== "");

  return start < 0 || first === undefined
    ? undefined
    : levelWord(first.split(":")[0] ?? "");
};

export interface IRiskInput {
  readonly paths: readonly string[];
  /** The PR body, which carries the author's record (Risk first). */
  readonly body: string;
  /** The independent reviewer's text, when a review ran. */
  readonly review: string | undefined;
  /** The highest level agents may merge, or "none". */
  readonly ceiling: Risk | "none";
}

export interface IRiskDecision {
  readonly level: Risk;
  /** True when the automation may merge it (merge-gate still decides). */
  readonly merge: boolean;
  /** Why, one line per reading, for the PR and the run summary. */
  readonly reasons: readonly string[];
}

/** The level of a pull request and whether an agent may merge it. */
export const decideRisk = (input: IRiskInput): IRiskDecision => {
  const floor = pathFloor(input.paths);
  const author = namedRisk(input.body);
  const reviewer =
    input.review === undefined ? undefined : namedRisk(input.review);
  const level = highest(floor, author ?? "low", reviewer ?? "low");
  const reviewed = reviewer !== undefined;
  const allowed =
    input.ceiling !== "none" && rank(level) <= rank(input.ceiling);
  const highPaths = input.paths.filter((path) => pathRisk(path) === "high");

  const reasons = [
    `Paths: ${floor}${highPaths.length > 0 ? ` (${highPaths.slice(0, 5).join(", ")})` : ""}.`,
    author === undefined ? "Author: no risk named." : `Author: ${author}.`,
    reviewer === undefined
      ? "Reviewer: no risk named."
      : `Reviewer: ${reviewer}.`,
    !reviewed
      ? "Not merged by an agent: no independent review named a risk."
      : allowed
        ? `Agents may merge up to ${input.ceiling}: merged when merge-gate passes.`
        : input.ceiling === "none"
          ? "Agents merge nothing here (AGENT_MERGE_MAX_RISK is none): a person merges."
          : `Above ${input.ceiling}, the most agents may merge: a person merges.`,
  ];

  return { level, merge: reviewed && allowed, reasons };
};

/** The ceiling a repository variable names; medium when it is unset or unknown. */
export const ceilingOf = (value: string | undefined): Risk | "none" => {
  const word = (value ?? "").trim().toLowerCase();

  if (word === "none") {
    return "none";
  }

  return isRisk(word) ? word : "medium";
};
