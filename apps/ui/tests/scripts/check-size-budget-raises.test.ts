import { describe, expect, it } from "vitest";

import {
  type IBudgetSnapshot,
  findBudgetRaiseViolations,
  parseLedger,
  parseLimitBytes,
  parseSizeLimit
} from "../../scripts/quality/check-size-budget-raises";

const REASON = "Tailwind grew with the new settings screens.";

function snapshot(
  limits: Record<string, string>,
  reasons: Record<string, string> = {}
): IBudgetSnapshot {
  return {
    limits: new Map(
      Object.entries(limits).map(([name, limit]) => [
        name,
        parseLimitBytes(limit)
      ])
    ),
    reasons: new Map(Object.entries(reasons))
  };
}

describe("parseLimitBytes", () => {
  it("reads KB, MB and B limits", () => {
    expect(parseLimitBytes("12 KB")).toBe(12 * 1024);
    expect(parseLimitBytes("1 MB")).toBe(1024 * 1024);
    expect(parseLimitBytes("512 B")).toBe(512);
  });

  it("rejects limits it cannot read", () => {
    expect(() => parseLimitBytes("twelve")).toThrow(/unsupported/u);
  });
});

describe("parseSizeLimit", () => {
  it("keeps entry names with parentheses and colons, skips entries without a limit", () => {
    const limits = parseSizeLimit(
      JSON.stringify([
        { name: "Initial route (cold start: index + react)", limit: "255 KB" },
        { name: "no limit here", path: "dist/x.js" }
      ])
    );

    expect([...limits.keys()]).toEqual([
      "Initial route (cold start: index + react)"
    ]);
  });
});

describe("parseLedger", () => {
  it("reads only reason lines, ignoring headings and prose", () => {
    const reasons = parseLedger(
      [
        "# Budget reasons",
        "",
        "Prose that mentions `budgets` and a colon: here.",
        "",
        "- `Initial route (cold start: index + react)`: Settings shell moved into the cold route.",
        "- `CSS (Tailwind compiled)`:    New tokens for the billing screens."
      ].join("\n")
    );

    expect(reasons.get("Initial route (cold start: index + react)")).toBe(
      "Settings shell moved into the cold route."
    );
    expect(reasons.get("CSS (Tailwind compiled)")).toBe(
      "New tokens for the billing screens."
    );
    expect(reasons.size).toBe(2);
  });
});

describe("findBudgetRaiseViolations", () => {
  it("fails a raised limit with no reason", () => {
    const violations = findBudgetRaiseViolations(
      snapshot({ CSS: "12 KB" }),
      snapshot({ CSS: "26.5 KB" })
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('"CSS"');
    expect(violations[0]).toContain("needs a reason line");
  });

  it("passes a raised limit whose reason is new in the change", () => {
    const violations = findBudgetRaiseViolations(
      snapshot({ CSS: "12 KB" }),
      snapshot({ CSS: "26.5 KB" }, { CSS: REASON })
    );

    expect(violations).toEqual([]);
  });

  it("fails a raise whose reason was already in the base", () => {
    const violations = findBudgetRaiseViolations(
      snapshot({ CSS: "12 KB" }, { CSS: REASON }),
      snapshot({ CSS: "26.5 KB" }, { CSS: REASON })
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("unchanged from the base");
  });

  it("passes a decrease with no reason", () => {
    const violations = findBudgetRaiseViolations(
      snapshot({ CSS: "26.5 KB" }),
      snapshot({ CSS: "12 KB" })
    );

    expect(violations).toEqual([]);
  });

  it("passes an unchanged limit with no reason", () => {
    const violations = findBudgetRaiseViolations(
      snapshot({ CSS: "12 KB" }),
      snapshot({ CSS: "12 KB" })
    );

    expect(violations).toEqual([]);
  });

  it("fails a new entry with no reason", () => {
    const violations = findBudgetRaiseViolations(
      snapshot({ CSS: "12 KB" }),
      snapshot({ CSS: "12 KB", "Billing chunk": "4 KB" })
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('"Billing chunk"');
    expect(violations[0]).toContain("new entry");
  });

  it("passes a new entry that carries a reason", () => {
    const violations = findBudgetRaiseViolations(
      snapshot({ CSS: "12 KB" }),
      snapshot(
        { CSS: "12 KB", "Billing chunk": "4 KB" },
        { "Billing chunk": REASON }
      )
    );

    expect(violations).toEqual([]);
  });

  it("treats a reason shorter than the minimum as missing", () => {
    const violations = findBudgetRaiseViolations(
      snapshot({ CSS: "12 KB" }),
      snapshot({ CSS: "26.5 KB" }, { CSS: "tbd" })
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("needs a reason line");
  });
});
