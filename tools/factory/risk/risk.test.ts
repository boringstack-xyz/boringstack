import { describe, expect, test } from "bun:test";

import { ceilingOf, decideRisk, highest, namedRisk, pathFloor } from "./risk";

describe("the paths set a floor", () => {
  test("docs and tests are low", () => {
    expect(
      pathFloor([
        "apps/docs/src/content/docs/index.mdx",
        "README.md",
        "apps/api/tests/lib/cache.test.ts",
        "apps/ui/src/components/Button.stories.tsx",
      ])
    ).toBe("low");
  });

  test("app and API code is medium", () => {
    expect(pathFloor(["apps/ui/src/pages/Dashboard.tsx", "README.md"])).toBe(
      "medium"
    );
    expect(pathFloor(["apps/api/src/api/dashboard/routes.ts"])).toBe("medium");
  });

  test("workflows, migrations, sign-in, billing, security and the factory are high", () => {
    for (const path of [
      ".github/workflows/merge-gate.yml",
      "apps/api/drizzle/0001_add.sql",
      "apps/api/src/api/auth/auth.routes.ts",
      "apps/api/src/api/billing/billing.service.ts",
      "apps/api/src/config/security/security.ts",
      "apps/api/src/lib/password/hash.ts",
      "apps/api/src/templates/email/welcome.tsx",
      "infra/k3s/base/api.yaml",
      "tools/factory/risk/risk.ts",
      "apps/admin/src/App.tsx",
      "apps/api/.env.example",
    ]) {
      expect(pathFloor([path])).toBe("high");
    }
  });

  test("no paths at all is low", () => {
    expect(pathFloor([])).toBe("low");
  });
});

describe("a named risk", () => {
  test("the PR body's first line, the review's Risk line, or the record's section", () => {
    expect(namedRisk("**Risk: low** (button copy)\n\nCloses #1")).toBe("low");
    expect(namedRisk("Verdict: approve\nRisk: medium\n1. nit")).toBe("medium");
    expect(
      namedRisk("## Risk\n\nhigh: the sign-in redirect\n\n## Review")
    ).toBe("high");
  });

  test("the older kinds read as levels", () => {
    expect(namedRisk("**Risk: ui** (copy)")).toBe("low");
    expect(namedRisk("**Risk: logic**")).toBe("medium");
    expect(namedRisk("## Risk\n\nauth-billing: plans")).toBe("high");
  });

  test("none, not set or unknown is undefined", () => {
    expect(namedRisk("Pending the independent review.")).toBeUndefined();
    expect(namedRisk("**Risk: not set**")).toBeUndefined();
    expect(namedRisk("Risk: enormous")).toBeUndefined();
  });
});

describe("the decision", () => {
  const reviewed = (risk: string): string =>
    `Verdict: approve\nRisk: ${risk}\n`;

  test("the highest reading wins", () => {
    expect(highest("low", "high", "medium")).toBe("high");
    expect(
      decideRisk({
        paths: ["apps/docs/src/content/docs/index.mdx"],
        body: "**Risk: low**",
        review: reviewed("medium"),
        ceiling: "medium",
      }).level
    ).toBe("medium");
  });

  test("an author cannot talk a high path down", () => {
    const decision = decideRisk({
      paths: [".github/workflows/agent-review.yml"],
      body: "**Risk: low** (a comment)",
      review: reviewed("low"),
      ceiling: "medium",
    });

    expect(decision.level).toBe("high");
    expect(decision.merge).toBe(false);
    expect(decision.reasons[0]).toContain(".github/workflows/agent-review.yml");
  });

  test("low and medium merge under the default ceiling once reviewed", () => {
    for (const risk of ["low", "medium"]) {
      expect(
        decideRisk({
          paths: ["apps/ui/src/pages/Dashboard.tsx"],
          body: `**Risk: ${risk}**`,
          review: reviewed(risk),
          ceiling: ceilingOf(undefined),
        }).merge
      ).toBe(true);
    }
  });

  test("without a review naming a risk, an agent never merges", () => {
    const decision = decideRisk({
      paths: ["README.md"],
      body: "**Risk: low**",
      review: undefined,
      ceiling: "high",
    });

    expect(decision.level).toBe("low");
    expect(decision.merge).toBe(false);
  });

  test("an author who names nothing adds nothing; the paths and the reviewer decide", () => {
    expect(
      decideRisk({
        paths: ["README.md"],
        body: "Pending the independent review.",
        review: reviewed("low"),
        ceiling: "low",
      })
    ).toMatchObject({ level: "low", merge: true });
  });

  test("the ceiling: none stops every agent merge; unknown reads as medium", () => {
    expect(ceilingOf("none")).toBe("none");
    expect(ceilingOf("LOW")).toBe("low");
    expect(ceilingOf("everything")).toBe("medium");
    expect(
      decideRisk({
        paths: ["README.md"],
        body: "**Risk: low**",
        review: reviewed("low"),
        ceiling: "none",
      }).merge
    ).toBe(false);
  });
});
