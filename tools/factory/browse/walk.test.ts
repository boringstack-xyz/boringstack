import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { parseSteps, scenarioOf, walkedLines } from "./walk.utils";

describe("factory walk", () => {
  test("only walkthrough files are walked", () => {
    const root = "/work/checkout";

    expect(scenarioOf(root, "apps/ui/e2e/walkthroughs/a.walk.ts")).toEqual({
      path: join(root, "apps/ui/e2e/walkthroughs/a.walk.ts"),
    });
    expect(scenarioOf(root, "apps/ui/e2e/walkthroughs/a.spec.ts")).toEqual({
      error: "a walkthrough file ends in .walk.ts",
    });
    expect(scenarioOf(root, "apps/ui/e2e/robot/a.walk.ts")).toEqual({
      error: "a walkthrough lives in apps/ui/e2e/walkthroughs/",
    });
    expect(scenarioOf(root, "../elsewhere/a.walk.ts")).toHaveProperty("error");
  });

  test("steps read back, and the list names each screenshot", () => {
    const steps = parseSteps([
      { index: 1, title: "Open the sign-up page", screenshot: "01-open.png" },
      { index: "2", title: "bad" },
    ]);

    expect(steps).toEqual([
      { index: 1, title: "Open the sign-up page", screenshot: "01-open.png" },
    ]);
    expect(walkedLines(steps, ".agent-state/factory/walk/r1")).toEqual([
      "  1. Open the sign-up page: .agent-state/factory/walk/r1/01-open.png",
    ]);
  });
});
