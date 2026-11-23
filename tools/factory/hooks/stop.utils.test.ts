import { describe, expect, test } from "bun:test";

import {
  alreadyChallenged,
  decideStop,
  MAX_IDENTICAL_BLOCKS,
  nextBlock,
  nextSessionStart,
  pendingUnits,
} from "./stop.utils";

const NONE: readonly string[] = [];

const base = {
  blocked: undefined,
  blockedConfirmed: false,
  pending: NONE,
  sessionId: "s1",
  gateRunning: false,
  gate: undefined,
  recordProblems: NONE,
  branch: "factory/issue-1",
};

describe("which units this session must verify", () => {
  test("only units changed this session and not green at their state", () => {
    expect(
      pendingUnits({
        current: { "apps/api": "a2", "apps/ui": "u1", tools: "t2" },
        green: { tools: "t2" },
        sessionStart: { "apps/api": "a1", "apps/ui": "u1", tools: "t1" },
        untouched: new Set(),
      })
    ).toEqual(["apps/api"]);
  });

  test("units identical to the base branch never count", () => {
    expect(
      pendingUnits({
        current: { "apps/api": "a2" },
        green: {},
        sessionStart: undefined,
        untouched: new Set(["apps/api"]),
      })
    ).toEqual([]);
  });

  test("a resumed session keeps its start and adds only new units", () => {
    expect(
      nextSessionStart({
        existing: { "apps/api": "a1" },
        current: { "apps/api": "a2", tools: "t1" },
        source: "resume",
      })
    ).toEqual({ "apps/api": "a1", tools: "t1" });
    expect(
      nextSessionStart({
        existing: { "apps/api": "a1" },
        current: { "apps/api": "a2" },
        source: "startup",
      })
    ).toEqual({ "apps/api": "a2" });
  });
});

describe("the stop decision", () => {
  test("nothing pending and nothing pushed: stop", () => {
    expect(decideStop(base).stop).toBe(true);
  });

  test("pending without a gate run: start the gate in the background", () => {
    const decision = decideStop({ ...base, pending: ["apps/api"] });

    expect(decision.stop).toBe(false);
    expect(decision.stop ? "" : decision.reason).toContain(
      "bun run factory gate --session s1"
    );
  });

  test("a running gate decides, not the red run before it", () => {
    expect(
      decideStop({
        ...base,
        pending: ["tools"],
        gateRunning: true,
        gate: { ok: false, summary: "blocked", evidence: "/x" },
      }).stop
    ).toBe(true);
  });

  test("a running gate lets the session pause", () => {
    expect(
      decideStop({ ...base, pending: ["apps/api"], gateRunning: true }).stop
    ).toBe(true);
  });

  test("a red gate keeps it working; a green one lets it stop", () => {
    const gate = { ok: false, summary: "api.tests failed", evidence: "/x" };

    expect(decideStop({ ...base, pending: ["apps/api"], gate }).stop).toBe(
      false
    );
    expect(
      decideStop({
        ...base,
        pending: ["apps/api"],
        gate: { ...gate, ok: true },
      }).stop
    ).toBe(true);
  });

  test("a pushed branch needs a complete record", () => {
    const decision = decideStop({
      ...base,
      recordProblems: ['section "Review" is not written'],
    });

    expect(decision.stop ? "" : decision.reason).toContain("Review");
  });

  test("blocked is challenged once, then honoured", () => {
    expect(decideStop({ ...base, blocked: "needs a Stripe key" }).stop).toBe(
      false
    );
    expect(
      decideStop({
        ...base,
        blocked: "needs a Stripe key",
        blockedConfirmed: true,
      }).stop
    ).toBe(true);
    expect(
      alreadyChallenged(" needs a Stripe key\n", "needs a Stripe key")
    ).toBe(true);
  });

  test("the third identical block in a row lets the session stop", () => {
    let previous;

    for (let count = 1; count < MAX_IDENTICAL_BLOCKS; count += 1) {
      const next = nextBlock({ reason: "r", stopHookActive: true, previous });

      expect(next.block).toBe(true);
      previous = next.block ? next.record : undefined;
    }

    expect(
      nextBlock({ reason: "r", stopHookActive: true, previous }).block
    ).toBe(false);
    expect(
      nextBlock({ reason: "other", stopHookActive: true, previous }).block
    ).toBe(true);
  });
});
