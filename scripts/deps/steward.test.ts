import { describe, expect, test } from "bun:test";
import {
  AGENT_LABEL,
  gateState,
  normalize,
  PERSON_LABEL,
  plan,
} from "./steward.mjs";

const pr = (overrides: Record<string, unknown> = {}) => ({
  number: 1,
  author: "app/dependabot",
  headRefName: "dependabot/bun/apps/ui/x",
  isDraft: false,
  autoMerge: true,
  autoMergeBy: "someone",
  mergeState: "CLEAN",
  labels: [] as string[],
  gate: "pass",
  ...overrides,
});

describe("gateState", () => {
  test("reads merge-gate only", () => {
    expect(gateState([])).toBe("none");
    expect(gateState([{ name: "validate", status: "COMPLETED", conclusion: "FAILURE" }])).toBe("none");
    expect(gateState([{ name: "merge-gate", status: "IN_PROGRESS" }])).toBe("pending");
    expect(gateState([{ name: "merge-gate", status: "COMPLETED", conclusion: "SUCCESS" }])).toBe("pass");
    expect(gateState([{ name: "merge-gate", status: "COMPLETED", conclusion: "FAILURE" }])).toBe("fail");
  });
});

describe("normalize", () => {
  test("maps gh pr list rows", () => {
    expect(
      normalize({
        number: 7,
        author: { login: "app/dependabot" },
        headRefName: "dependabot/x",
        isDraft: false,
        labels: [{ name: AGENT_LABEL }],
        autoMergeRequest: null,
        mergeStateStatus: "BEHIND",
        statusCheckRollup: [],
      })
    ).toEqual({
      number: 7,
      author: "app/dependabot",
      headRefName: "dependabot/x",
      isDraft: false,
      autoMerge: false,
      autoMergeBy: "",
      mergeState: "BEHIND",
      labels: [AGENT_LABEL],
      gate: "none",
    });
  });
});

describe("plan", () => {
  test("turns on auto-merge for dependency PRs only", () => {
    const result = plan(
      [
        pr({ number: 1, autoMerge: false }),
        pr({ number: 2, author: "someone", headRefName: "deps/autofix", autoMerge: false }),
        pr({ number: 3, author: "someone", headRefName: "feat/x", autoMerge: false }),
      ],
      { agentsEnabled: false }
    );

    expect(result.actions).toEqual([
      { kind: "auto-merge", pr: 1 },
      { kind: "auto-merge", pr: 2 },
    ]);
  });

  test("arms auto-merge again when the workflow token armed it", () => {
    expect(
      plan([pr({ number: 5, autoMergeBy: "app/github-actions" })], { agentsEnabled: false }).actions
    ).toEqual([{ kind: "rearm", pr: 5 }]);
  });

  test("brings a PR that fell behind up to date, unless it is failing", () => {
    const result = plan(
      [pr({ number: 1, mergeState: "BEHIND" }), pr({ number: 2, mergeState: "BEHIND", gate: "fail", labels: [AGENT_LABEL, PERSON_LABEL] })],
      { agentsEnabled: true }
    );

    expect(result.actions).toEqual([{ kind: "update-branch", pr: 1 }]);
  });

  test("hands one failing Dependabot PR to the agent, lowest number first", () => {
    const result = plan(
      [pr({ number: 9, gate: "fail" }), pr({ number: 4, gate: "fail" })],
      { agentsEnabled: true }
    );

    expect(result.fix).toBe(4);
  });

  test("never hands a PR to the agent when agents are off", () => {
    expect(plan([pr({ gate: "fail" })], { agentsEnabled: false }).fix).toBeNull();
  });

  test("asks a person once when the agent's attempt still fails", () => {
    const tried = pr({ gate: "fail", labels: [AGENT_LABEL] });

    expect(plan([tried], { agentsEnabled: true })).toEqual({
      actions: [{ kind: "needs-person", pr: 1 }],
      fix: null,
    });
    expect(
      plan([pr({ gate: "fail", labels: [AGENT_LABEL, PERSON_LABEL] })], { agentsEnabled: true }).actions
    ).toEqual([]);
  });

  test("skips drafts", () => {
    expect(plan([pr({ isDraft: true, autoMerge: false })], { agentsEnabled: true }).actions).toEqual([]);
  });
});
