import { describe, expect, test } from "bun:test";

import { EMPTY_LEDGER, type ILedger } from "../fleet/findings.utils";
import {
  dispatchInput,
  parseTriageInput,
  planProblems,
  readPlan,
  type ITriageFinding,
  triageBatch,
  triageComment,
} from "./triage";

const finding = (id: string, count: number, filed: string | null = null) => ({
  id,
  service: "api",
  event: null,
  signature: `boom ${id}`,
  count,
  firstSeen: "2026-11-22T00:00:00Z",
  lastSeen: "2026-11-23T00:00:00Z",
  example: `boom ${id} for [redacted]`,
  muted: false,
  filed: filed === null ? null : { url: filed },
});

const ledger: ILedger = {
  ...EMPTY_LEDGER,
  findings: [
    finding("a", 2),
    finding("b", 9),
    finding("c", 5, "https://github.com/o/r/issues/1"),
    { ...finding("d", 50), muted: true },
    finding("e", 7),
  ],
};

const row = (id: string): ITriageFinding => ({
  id,
  service: "api",
  signature: `boom ${id}`,
  count: 1,
  example: "",
  filed: null,
});

describe("triage batch", () => {
  test("takes unmuted findings without an issue, most frequent first, up to the batch size", () => {
    expect(triageBatch(ledger).map((item) => item.id)).toEqual(["b", "e", "a"]);
    expect(triageBatch(ledger, 1).map((item) => item.id)).toEqual(["b"]);
  });

  test("the dispatch input is cut down to fit GitHub's limit", () => {
    const big = Array.from({ length: 200 }, (_, index) => ({
      ...row(`f${String(index)}`),
      signature: "x".repeat(1000),
    }));
    const text = dispatchInput(big);

    expect(text.length).toBeLessThanOrEqual(60_000);
    const parsed: unknown = JSON.parse(text);

    expect(Array.isArray(parsed)).toBe(true);
  });

  test("the workflow input is validated before use", () => {
    expect(parseTriageInput("not json")).toBe(
      "The findings input is not JSON."
    );
    expect(parseTriageInput("[]")).toBe("The findings input is an empty list.");
    expect(parseTriageInput(JSON.stringify([{ id: 1 }]))).toBe(
      "Some findings in the input are malformed."
    );
    expect(parseTriageInput(JSON.stringify([row("a")]))).toEqual([row("a")]);
  });
});

describe("triage plan", () => {
  const plan = (overrides: Record<string, unknown> = {}) => ({
    items: [
      {
        finding: "a",
        problem: "boom a",
        cause: "null session",
        outcome: "fix",
      },
      {
        finding: "b",
        problem: "boom b",
        cause: "disk full",
        outcome: "ops",
        action: "Add disk on the database host.",
      },
    ],
    fix: {
      slug: "null-session",
      title: "fix(api): keep the session",
      items: ["a"],
    },
    ...overrides,
  });

  test("a complete plan with its fix has no problems", () => {
    expect(planProblems(plan(), ["a", "b"])).toEqual([]);
  });

  test("the plan must cover every finding in the run, once", () => {
    expect(
      planProblems(plan({ items: [plan().items[0]] }), ["a", "b"])
    ).toContain("finding b has no item");
    expect(planProblems(plan(), ["a"])).toContain(
      "item 1 names no finding in this run"
    );
  });

  test("an ops item needs an action, a fix needs a slug and items with outcome fix", () => {
    const noAction = plan({
      items: [plan().items[0], { ...plan().items[1], action: "" }],
    });

    expect(planProblems(noAction, ["a", "b"])).toContain(
      "item 1 is ops with no action for a person"
    );
    expect(
      planProblems(plan({ fix: { slug: "X", title: "t", items: ["b"] } }), [
        "a",
        "b",
      ])
    ).toEqual([
      "fix.slug must be lowercase-hyphenated",
      "fix addresses b, which has no outcome fix",
    ]);
    expect(planProblems(plan({ fix: null }), ["a", "b"])).toContain(
      "an item has outcome fix but there is no fix"
    );
  });

  test("the comment names each outcome and the fix PR", () => {
    const typed = readPlan(plan(), ["a", "b"]);

    if (Array.isArray(typed)) {
      throw new Error(typed.join("; "));
    }

    const text = triageComment(typed, {
      prUrl: "https://github.com/o/r/pull/9",
      proven: true,
    });

    expect(text).toContain(
      "fix PR https://github.com/o/r/pull/9 (proven by its test)"
    );
    expect(text).toContain("needs a person (infrastructure or operations)");
    expect(text).toContain("Some causes need a person");
  });
});
