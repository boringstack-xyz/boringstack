import { describe, expect, test } from "bun:test";

import {
  AGENT_SECTIONS,
  draft,
  notVerifiedItems,
  problems,
  riskOf,
} from "./verification.utils";

const HEAD = "0123456789abcdef0123456789abcdef01234567";

const filled = (overrides: Record<string, string> = {}): string => {
  const base = draft({
    branch: "factory/issue-7",
    commit: HEAD,
    issue: "#7",
    checks: "agent-verify: passed",
  });

  return AGENT_SECTIONS.reduce((text, item) => {
    const value =
      overrides[item.title] ??
      (item.title === "Risk" ? "logic: the dashboard query" : "Nothing");

    return text.replace(new RegExp(`TODO: [^\\n]*`, "u"), value);
  }, base);
};

describe("verification record", () => {
  test("a draft lists every unwritten section", () => {
    const text = draft({
      branch: "b",
      commit: HEAD,
      issue: undefined,
      checks: undefined,
    });

    expect(problems(text, HEAD)).toContain('section "Risk" is not written');
    expect(problems(text, HEAD)).toContain("no factory verify run is recorded");
  });

  test("a filled record of the head commit is complete", () => {
    expect(problems(filled(), HEAD)).toEqual([]);
    expect(riskOf(filled())).toBe("logic");
  });

  test("a record of an older commit does not count", () => {
    expect(problems(filled(), "fedcba9876543210")).toHaveLength(1);
  });

  test("risk must be a known level", () => {
    expect(problems(filled({ Risk: "huge: everything" }), HEAD)).toEqual([
      "Risk must start with one of ui, logic, data, auth-billing",
    ]);
  });

  test("not-verified items are listed, 'Nothing' is not an item", () => {
    expect(notVerifiedItems(filled())).toEqual([]);
    expect(
      notVerifiedItems(
        filled({ "Not verified": "- email delivery\n- the yearly price" })
      )
    ).toEqual(["email delivery", "the yearly price"]);
  });
});
