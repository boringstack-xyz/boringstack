import { describe, expect, test } from "bun:test";

import {
  branchFor,
  capDecision,
  laneFromBranch,
  lanePathProblems,
  laneProblems,
  LANES,
} from "./lanes";

const NOW = Date.parse("2026-11-23T12:00:00Z");
const DAY = 86_400_000;

describe("lane branches", () => {
  test("an agent branch names its lane; anything else names none", () => {
    expect(laneFromBranch("agent/triage/fix-null-session")).toBe("triage");
    expect(laneFromBranch("agent/writer/post")).toBeUndefined();
    expect(laneFromBranch("feat/agent-lanes")).toBeUndefined();
    expect(branchFor("triage", "fix-null")).toBe("agent/triage/fix-null");
  });
});

describe("lane scope", () => {
  test("the triage lane takes source and tests, never workflows, infrastructure or factory tooling", () => {
    expect(
      lanePathProblems("triage", [
        "apps/api/src/lib/cache.ts",
        "apps/api/tests/lib/cache.test.ts",
      ])
    ).toEqual([]);
    expect(
      lanePathProblems("triage", [
        ".github/workflows/apps-api-ci.yml",
        "infra/compose/compose.yaml",
        "tools/factory/lanes/lanes.ts",
        "apps/api/src/api/auth/login.ts",
        "apps/api/drizzle/0001.sql",
        "docs/readme.md",
      ])
    ).toEqual([
      ".github/workflows/apps-api-ci.yml",
      "infra/compose/compose.yaml",
      "tools/factory/lanes/lanes.ts",
      "apps/api/src/api/auth/login.ts",
      "apps/api/drizzle/0001.sql",
      "docs/readme.md",
    ]);
  });

  test("a triage change with no test file is refused, and an empty change is refused", () => {
    expect(laneProblems("triage", ["apps/api/src/lib/cache.ts"])).toEqual([
      "This lane needs a regression test file in the change.",
    ]);
    expect(laneProblems("triage", [])).toEqual([
      "The change is empty.",
      "This lane needs a regression test file in the change.",
    ]);
    expect(
      laneProblems("triage", [
        "apps/api/src/lib/cache.ts",
        "apps/api/tests/lib/cache.test.ts",
      ])
    ).toEqual([]);
  });

  test("the lane registry names only what it allows", () => {
    expect(Object.keys(LANES)).toEqual(["triage"]);
    expect(LANES.triage.needsTest).toBe(true);
  });
});

describe("lane caps", () => {
  const pr = (
    headRefName: string,
    state: string,
    extra: { mergedAt?: string; closedAt?: string } = {}
  ) => ({
    headRefName,
    state,
    mergedAt: null,
    closedAt: null,
    ...extra,
  });

  test("a lane with nothing open or merged may run one PR", () => {
    expect(capDecision("triage", [], NOW)).toEqual({
      run: true,
      slots: 1,
      result: "",
      reason: "open 0/2, merged in 7 days 0/7",
    });
  });

  test("a lane at its open cap waits", () => {
    const decision = capDecision(
      "triage",
      [pr("agent/triage/a", "OPEN"), pr("agent/triage/b", "OPEN")],
      NOW
    );

    expect(decision.run).toBe(false);
    expect(decision.result).toBe("skipped-open-pr");
  });

  test("merges in the last seven days count; older ones do not", () => {
    const merged = (days: number) =>
      pr("agent/triage/x", "MERGED", {
        mergedAt: new Date(NOW - days * DAY).toISOString(),
      });
    const recent = Array.from({ length: 7 }, () => merged(1));

    expect(capDecision("triage", recent, NOW).result).toBe("skipped-cap");
    expect(
      capDecision(
        "triage",
        Array.from({ length: 7 }, () => merged(9)),
        NOW
      ).run
    ).toBe(true);
  });

  test("two PRs in a row closed without merging stop the lane", () => {
    const closed = (at: number) =>
      pr("agent/triage/x", "CLOSED", {
        closedAt: new Date(NOW - at * DAY).toISOString(),
      });

    expect(capDecision("triage", [closed(1), closed(2)], NOW).result).toBe(
      "skipped-failed-twice"
    );
    expect(
      capDecision(
        "triage",
        [
          closed(1),
          pr("agent/triage/y", "MERGED", {
            mergedAt: new Date(NOW - 2 * DAY).toISOString(),
          }),
        ],
        NOW
      ).run
    ).toBe(true);
  });

  test("PRs from other branches never count", () => {
    expect(
      capDecision(
        "triage",
        [pr("feat/x", "OPEN"), pr("agent/writer/y", "OPEN")],
        NOW
      ).run
    ).toBe(true);
  });
});
