/*
 * The agent lanes. Every agent PR comes from a branch agent/<lane>/<slug>, and
 * the lane decides which paths that PR may change, whether its fix must come
 * with a regression test, and how many agent PRs may be open or merged at
 * once. Adapted from earlier agent factories, where the lanes
 * are wider (articles, diagrams, catalogues). Only the generic triage lane is
 * here. Who merges goes by risk: agent-merge.yml merges low and medium after
 * the independent review approves; a person merges high (../risk/risk.ts).
 */
import type { ICommandOutcome } from "../result";
import { isRecord } from "../state";

export interface ILane {
  readonly description: string;
  /** Repo-relative paths the lane may change. */
  readonly allow: readonly RegExp[];
  /** Paths the lane never changes, whatever `allow` says. */
  readonly deny: readonly RegExp[];
  /** A fix in this lane must come with a regression test (see prove-fix). */
  readonly needsTest: boolean;
  /** Agent PRs that may be open at once. */
  readonly maxOpen: number;
  /** Agent PRs that may be merged in seven days. */
  readonly maxMergedPer7Days: number;
  /** Agent PRs one run may open. */
  readonly perRun: number;
  /** What the reviewer checks, in plain words. */
  readonly brief: string;
}

/** Paths no agent lane may change: the workflows, infrastructure, release and factory tooling. */
export const PROTECTED: readonly RegExp[] = [
  /^\.github\//u,
  /^infra\//u,
  /^\.claude\//u,
  /^\.tsforge\//u,
  /^tools\/factory\//u,
  /^tools\/agent\//u,
  /^scripts\/(release|ci)\//u,
  /(^|\/)CODEOWNERS$/u,
  /^apps\/api\/drizzle\//u,
  /^apps\/api\/src\/api\/(auth|billing|accounts)\//u,
];

/** A test file a code lane may add or change, as the proof reads it. */
export const TEST_FILE =
  /(^apps\/api\/tests\/.+\.ts$)|(\.test\.tsx?$)|(\.spec\.tsx?$)/u;

export type LaneName = "triage";

export const LANES: Readonly<Record<LaneName, ILane>> = {
  triage: {
    description:
      "Root-causes one error from the findings ledger (agent-triage.yml).",
    allow: [
      /^apps\/api\/src\//u,
      /^apps\/api\/tests\//u,
      /^apps\/ui\/src\//u,
      /^apps\/site\/src\//u,
    ],
    deny: PROTECTED,
    needsTest: true,
    maxOpen: 2,
    maxMergedPer7Days: 7,
    perRun: 1,
    brief: `This PR fixes the root cause of an error listed in the findings given to the
triage run. Check that the diagnosis in the PR body is supported by the log
lines and by the code; that the diff fixes that cause rather than hiding the
error (no swallowed errors, no lowered log levels, no removed checks); that it
has a regression test that exercises the failing path; and that the proof in the
PR body shows the test failing on the base commit and passing with the fix.`,
  },
};

const BRANCH = /^agent\/([a-z0-9-]+)\/([a-z0-9-]+)$/u;

export const isLaneName = (name: string): name is LaneName =>
  Object.hasOwn(LANES, name);

/** The lane a name names, or undefined. */
export const laneNamed = (name: string | undefined): LaneName | undefined =>
  name !== undefined && isLaneName(name) ? name : undefined;

/** The lane name from an agent branch, or undefined for anything else. */
export const laneFromBranch = (branch: string): LaneName | undefined =>
  laneNamed(BRANCH.exec(branch)?.[1]);

/** The branch an agent in this lane works on. */
export const branchFor = (lane: LaneName, slug: string): string =>
  `agent/${lane}/${slug}`;

/** Paths in the change set that the lane does not allow. */
export const lanePathProblems = (
  lane: LaneName,
  paths: readonly string[]
): string[] => {
  const spec = LANES[lane];

  return paths.filter(
    (path) =>
      !spec.allow.some((pattern) => pattern.test(path)) ||
      spec.deny.some((pattern) => pattern.test(path))
  );
};

/** Everything wrong with a lane's change set, as plain lines. Empty when it may go to review. */
export const laneProblems = (
  lane: LaneName,
  paths: readonly string[]
): string[] => {
  const outside = lanePathProblems(lane, paths);
  const needsTest = LANES[lane].needsTest;

  return [
    ...(paths.length === 0 ? ["The change is empty."] : []),
    ...(outside.length > 0
      ? [`Not allowed for agents: ${outside.join(", ")}`]
      : []),
    ...(needsTest && !paths.some((path) => TEST_FILE.test(path))
      ? ["This lane needs a regression test file in the change."]
      : []),
  ];
};

/** A row of `gh pr list --json headRefName,state,mergedAt,closedAt`. */
export interface IAgentPr {
  readonly headRefName: string;
  readonly state: string;
  readonly mergedAt: string | null;
  readonly closedAt: string | null;
}

/** The PR rows from parsed gh output; anything that is not a row is dropped. */
export const parsePrRows = (raw: unknown): IAgentPr[] =>
  Array.isArray(raw)
    ? raw.filter(isRecord).flatMap((row): IAgentPr[] =>
        typeof row.headRefName === "string" && typeof row.state === "string"
          ? [
              {
                headRefName: row.headRefName,
                state: row.state,
                mergedAt:
                  typeof row.mergedAt === "string" ? row.mergedAt : null,
                closedAt:
                  typeof row.closedAt === "string" ? row.closedAt : null,
              },
            ]
          : []
      )
    : [];

export interface ICapDecision {
  readonly run: boolean;
  readonly slots: number;
  readonly result:
    "" | "skipped-open-pr" | "skipped-cap" | "skipped-failed-twice";
  readonly reason: string;
}

const DAY_MS = 86_400_000;
const OPEN = "OPEN";
const CLOSED = "CLOSED";

/**
 * Whether a run may start a new agent PR in this lane: none open beyond the
 * lane cap, the weekly merge cap not reached, and the lane's last two finished
 * PRs not both closed unmerged (two failures in a row stop the lane until a
 * person looks).
 */
export const capDecision = (
  lane: LaneName,
  prs: readonly IAgentPr[],
  nowMs: number
): ICapDecision => {
  const spec = LANES[lane];
  const own = prs.filter((pr) => laneFromBranch(pr.headRefName) === lane);
  const open = own.filter((pr) => pr.state === OPEN).length;
  const weekAgo = nowMs - 7 * DAY_MS;
  const merged = own.filter(
    (pr) => pr.mergedAt !== null && Date.parse(pr.mergedAt) > weekAgo
  ).length;
  const finished = own
    .filter((pr) => pr.state !== OPEN)
    .sort(
      (left, right) =>
        Date.parse(right.closedAt ?? right.mergedAt ?? "0") -
        Date.parse(left.closedAt ?? left.mergedAt ?? "0")
    )
    .slice(0, 2);
  const failedTwice =
    finished.length === 2 && finished.every((pr) => pr.state === CLOSED);
  const reason = `open ${String(open)}/${String(spec.maxOpen)}, merged in 7 days ${String(merged)}/${String(spec.maxMergedPer7Days)}`;

  if (open >= spec.maxOpen) {
    return { run: false, slots: 0, result: "skipped-open-pr", reason };
  }

  if (merged >= spec.maxMergedPer7Days) {
    return { run: false, slots: 0, result: "skipped-cap", reason };
  }

  if (failedTwice) {
    return {
      run: false,
      slots: 0,
      result: "skipped-failed-twice",
      reason: "The lane's last two PRs closed without merging.",
    };
  }

  return {
    run: true,
    slots: Math.min(
      spec.perRun,
      spec.maxOpen - open,
      spec.maxMergedPer7Days - merged
    ),
    result: "",
    reason,
  };
};

/** `factory lanes`: the registry, one line per lane. */
export const lanesList = (): ICommandOutcome => ({
  code: 0,
  summary: Object.entries(LANES)
    .map(
      ([name, spec]) =>
        `${name}: ${spec.description} Open at most ${String(spec.maxOpen)}; merged at most ${String(spec.maxMergedPer7Days)} in 7 days.`
    )
    .join("\n"),
  data: Object.keys(LANES),
});
