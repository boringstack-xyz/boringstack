/*
 * The weekly agent digest, as Markdown for the repository owner: agent PRs
 * merged, closed without merging and still open this week, and agent workflow
 * runs that failed (a later success clears a failure). Read from GitHub with
 * gh, so it runs in CI with the workflow token. Ported from the Tinkercaster
 * digest without the search-console and site parts.
 */
import { isRecord } from "../state";

const DAY_MS = 86_400_000;
const OPEN = "OPEN";
const CLOSED = "CLOSED";
const FAILURE = "failure";

export interface IWindow {
  readonly start: number;
  readonly end: number;
}

export interface IPullRow {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly headRefName: string;
  readonly state: string;
  readonly mergedAt: string | null;
  readonly closedAt: string | null;
}

export interface IRunRow {
  readonly name: string;
  readonly conclusion: string;
  readonly headBranch: string;
  readonly createdAt: string;
  readonly url: string;
}

/** The seven days ending at `now`. */
export const weekWindow = (nowMs: number): IWindow => ({
  start: nowMs - 7 * DAY_MS,
  end: nowMs,
});

const inWindow = (iso: string | null, window: IWindow): boolean =>
  iso !== null &&
  Date.parse(iso) >= window.start &&
  Date.parse(iso) < window.end;

/** Agent PRs by what happened to them in the window. Human PRs are ignored. */
export const agentPrsInWindow = (
  prs: readonly IPullRow[],
  window: IWindow
): { merged: IPullRow[]; closed: IPullRow[]; open: IPullRow[] } => {
  const agent = prs.filter((pr) => pr.headRefName.startsWith("agent/"));

  return {
    merged: agent.filter((pr) => inWindow(pr.mergedAt, window)),
    closed: agent.filter(
      (pr) =>
        pr.state === CLOSED &&
        pr.mergedAt === null &&
        inWindow(pr.closedAt, window)
    ),
    open: agent.filter((pr) => pr.state === OPEN),
  };
};

/** The agent workflow runs that failed in the window, keeping only each workflow's and branch's latest run. */
export const latestFailures = (
  runs: readonly IRunRow[],
  window: IWindow
): IRunRow[] => {
  const latest = new Map<string, IRunRow>();

  for (const run of runs) {
    if (!run.name.startsWith("Agent ") || !inWindow(run.createdAt, window)) {
      continue;
    }

    const key = `${run.name}\u0000${run.headBranch}`;
    const known = latest.get(key);

    if (
      known === undefined ||
      Date.parse(run.createdAt) > Date.parse(known.createdAt)
    ) {
      latest.set(key, run);
    }
  }

  return [...latest.values()].filter((run) => run.conclusion === FAILURE);
};

const pr = (row: IPullRow): string =>
  `- [#${String(row.number)}](${row.url}) \`${row.headRefName}\`: ${row.title}`;

/** The digest as Markdown. Empty sections say so rather than vanish. */
export const digestMarkdown = (input: {
  readonly nowMs: number;
  readonly prs: readonly IPullRow[];
  readonly runs: readonly IRunRow[];
}): string => {
  const window = weekWindow(input.nowMs);
  const { merged, closed, open } = agentPrsInWindow(input.prs, window);
  const failures = latestFailures(input.runs, window);
  const section = (title: string, rows: readonly string[]): string[] => [
    `## ${title}`,
    "",
    ...(rows.length === 0 ? ["Nothing this week."] : rows),
    "",
  ];

  return [
    `# Agent digest, week ending ${new Date(input.nowMs).toISOString().slice(0, 10)}`,
    "",
    ...section("Agent PRs merged", merged.map(pr)),
    ...section("Agent PRs closed without merging", closed.map(pr)),
    ...section(
      "Agent PRs still open (revert a merged one with git revert on main)",
      open.map(pr)
    ),
    ...section(
      "Agent workflow failures (latest run per workflow and branch)",
      failures.map(
        (run) =>
          `- [${run.name}](${run.url}) on \`${run.headBranch}\` at ${run.createdAt}`
      )
    ),
  ].join("\n");
};

/** The gh pr list rows the digest reads, validated. */
export const parsePulls = (raw: unknown): IPullRow[] =>
  Array.isArray(raw)
    ? raw.filter(isRecord).flatMap((row): IPullRow[] =>
        typeof row.number === "number" &&
        typeof row.title === "string" &&
        typeof row.url === "string" &&
        typeof row.headRefName === "string" &&
        typeof row.state === "string"
          ? [
              {
                number: row.number,
                title: row.title,
                url: row.url,
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

/** The gh run list rows the digest reads, validated. */
export const parseRuns = (raw: unknown): IRunRow[] =>
  Array.isArray(raw)
    ? raw.filter(isRecord).flatMap((row): IRunRow[] =>
        typeof row.name === "string" &&
        typeof row.conclusion === "string" &&
        typeof row.headBranch === "string" &&
        typeof row.createdAt === "string" &&
        typeof row.url === "string"
          ? [
              {
                name: row.name,
                conclusion: row.conclusion,
                headBranch: row.headBranch,
                createdAt: row.createdAt,
                url: row.url,
              },
            ]
          : []
      )
    : [];
