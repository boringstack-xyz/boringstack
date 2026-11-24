import { describe, expect, test } from "bun:test";

import {
  agentPrsInWindow,
  digestMarkdown,
  latestFailures,
  type IPullRow,
  type IRunRow,
  weekWindow,
} from "./digest";

const NOW = Date.parse("2026-11-23T12:00:00Z");
const daysAgo = (days: number): string =>
  new Date(NOW - days * 86_400_000).toISOString();

const pr = (
  number: number,
  headRefName: string,
  state: string,
  extra: Partial<IPullRow> = {}
): IPullRow => ({
  number,
  title: `PR ${String(number)}`,
  url: `https://github.com/o/r/pull/${String(number)}`,
  headRefName,
  state,
  mergedAt: null,
  closedAt: null,
  ...extra,
});

const run = (
  name: string,
  conclusion: string,
  createdDays: number,
  branch = "agent/triage/x"
): IRunRow => ({
  name,
  conclusion,
  headBranch: branch,
  createdAt: daysAgo(createdDays),
  url: "https://github.com/o/r/actions/runs/1",
});

describe("agent digest", () => {
  const window = weekWindow(NOW);

  test("counts agent PRs only, by what happened to them in the week", () => {
    const prs = [
      pr(1, "agent/triage/a", "MERGED", { mergedAt: daysAgo(2) }),
      pr(2, "agent/triage/b", "CLOSED", { closedAt: daysAgo(3) }),
      pr(3, "agent/triage/c", "OPEN"),
      pr(4, "feat/human", "MERGED", { mergedAt: daysAgo(1) }),
      pr(5, "agent/triage/old", "MERGED", { mergedAt: daysAgo(20) }),
    ];
    const { merged, closed, open } = agentPrsInWindow(prs, window);

    expect(merged.map((row) => row.number)).toEqual([1]);
    expect(closed.map((row) => row.number)).toEqual([2]);
    expect(open.map((row) => row.number)).toEqual([3]);
  });

  test("a failed agent run counts only when its latest run in the week failed", () => {
    const runs = [
      run("Agent triage", "failure", 1),
      run("Agent triage", "success", 0.5),
      run("Agent review", "failure", 2, "agent/triage/z"),
      run("CI", "failure", 1),
    ];

    expect(latestFailures(runs, window).map((row) => row.name)).toEqual([
      "Agent review",
    ]);
  });

  test("the Markdown says when a section is empty", () => {
    const text = digestMarkdown({ nowMs: NOW, prs: [], runs: [] });

    expect(text).toContain("# Agent digest, week ending 2026-11-23");
    expect(text.match(/Nothing this week\./gu)?.length).toBe(4);
  });
});
