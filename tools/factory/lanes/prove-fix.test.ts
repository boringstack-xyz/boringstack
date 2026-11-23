import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { IRunOptions, IRunResult } from "../fleet/process";
import {
  proofVerdict,
  proveFix,
  skippedIn,
  splitChange,
  testPlan,
} from "./prove-fix";

const FIX = "apps/api/src/lib/cache.ts";
const TEST = "apps/api/tests/lib/cache.test.ts";

const okRun = (stdout = ""): IRunResult => ({ status: 0, stdout, stderr: "" });

describe("splitting a change", () => {
  test("test files are tests; everything else is a fix", () => {
    expect(splitChange([FIX, TEST, "apps/ui/src/Button.spec.tsx"])).toEqual({
      tests: [TEST, "apps/ui/src/Button.spec.tsx"],
      fixes: [FIX],
    });
  });

  test("one plan step per app, with paths relative to that app", () => {
    const plan = testPlan([TEST, "apps/ui/src/Button.test.tsx"]);

    expect(plan.map((step) => step.app)).toEqual(["apps/api", "apps/ui"]);
    expect(plan[0]?.run).toEqual([
      "env",
      "NODE_ENV=test",
      "LOG_LEVEL=error",
      "bun",
      "test",
      "--timeout",
      "30000",
      "tests/lib/cache.test.ts",
    ]);
    expect(plan[1]?.run).toEqual([
      "bunx",
      "vitest",
      "run",
      "src/Button.test.tsx",
    ]);
  });
});

describe("skipped tests", () => {
  test("bun and vitest summaries both count skips", () => {
    expect(skippedIn(" 4 pass\n 2 skip\n 0 fail")).toBe(2);
    expect(skippedIn("Tests  1 skipped | 3 passed")).toBe(1);
    expect(skippedIn(" 4 pass\n 0 fail")).toBe(0);
  });
});

describe("proof verdict", () => {
  const plan = testPlan(["apps/api/tests/a.test.ts"]);
  const base = {
    tests: ["apps/api/tests/a.test.ts"],
    fixes: ["apps/api/src/a.ts"],
    plan,
  };
  const failing = { code: 1, log: " 0 pass\n 1 fail" };
  const passing = { code: 0, log: " 1 pass\n 0 fail" };

  test("fails without the fix and passes with it: proven", () => {
    expect(
      proofVerdict({ ...base, withoutFix: failing, withFix: passing }).proven
    ).toBe(true);
  });

  test("tests that pass on the base code do not prove the fix", () => {
    expect(
      proofVerdict({ ...base, withoutFix: passing, withFix: passing })
    ).toEqual({
      proven: false,
      reason: "The tests pass without the fix, so they do not prove it.",
    });
  });

  test("a runner that cannot start is not a proof", () => {
    expect(
      proofVerdict({
        ...base,
        withoutFix: { code: 127, log: "" },
        withFix: passing,
      }).reason
    ).toBe("The test runner could not start.");
  });

  test("skipped tests with the fix applied are not a pass", () => {
    expect(
      proofVerdict({
        ...base,
        withoutFix: failing,
        withFix: { code: 0, log: " 0 pass\n 3 skip" },
      })
    ).toEqual({
      proven: false,
      reason:
        "Some tests were skipped with the fix applied, so they do not prove it.",
    });
  });

  test("a change without a fix, a test or a runner is not proven before any run", () => {
    expect(
      proofVerdict({
        tests: base.tests,
        fixes: [],
        plan,
        withoutFix: failing,
        withFix: passing,
      }).reason
    ).toBe("The change has no fix, only tests.");
    expect(
      proofVerdict({
        tests: [],
        fixes: base.fixes,
        plan,
        withoutFix: failing,
        withFix: passing,
      }).reason
    ).toBe("The change has no regression test.");
    expect(
      proofVerdict({
        tests: ["docs/a.test.md"],
        fixes: base.fixes,
        plan: [],
        withoutFix: failing,
        withFix: passing,
      }).reason
    ).toBe("No test runner for these test files.");
  });
});

describe("proveFix", () => {
  test("runs the tests on HEAD, restores the fix, runs them again and leaves the tree as it was", () => {
    const root = mkdtempSync(join(tmpdir(), "lanes-prove-"));
    const fixPath = join(root, FIX);
    const testPath = join(root, TEST);

    mkdirSync(join(root, "apps/api/src/lib"), { recursive: true });
    mkdirSync(join(root, "apps/api/tests/lib"), { recursive: true });
    writeFileSync(fixPath, "export const value = 'fix';\n");
    writeFileSync(testPath, "test('x', () => {});\n");

    const seenFix: string[] = [];
    const commands: string[] = [];

    const run = (
      program: string,
      args: readonly string[],
      options?: IRunOptions
    ): IRunResult => {
      commands.push([program, ...args].join(" "));

      if (program === "git" && args[0] === "ls-tree") {
        return okRun("apps/api/src/lib/cache.ts\n");
      }

      if (program === "git" && args[0] === "checkout") {
        writeFileSync(fixPath, "export const value = 'base';\n");

        return okRun();
      }

      if (program === "env") {
        // The base code fails the test; the fix makes it pass.
        const current = readFileSync(fixPath, "utf8");

        seenFix.push(current.includes("base") ? "base" : "fix");

        return current.includes("base")
          ? { status: 1, stdout: " 0 pass\n 1 fail", stderr: "" }
          : okRun(" 1 pass\n 0 fail");
      }

      expect(options?.cwd).toBeDefined();

      return okRun();
    };

    const report = proveFix([FIX, TEST], { run, root });

    expect(report.proven).toBe(true);
    expect(seenFix).toEqual(["base", "fix"]);
    expect(readFileSync(fixPath, "utf8")).toBe("export const value = 'fix';\n");
    expect(commands).toContain(`git checkout HEAD -- ${FIX}`);
  });

  test("a change with no test is reported unproven without running anything", () => {
    const calls: string[] = [];
    const report = proveFix([FIX], {
      run: (program) => {
        calls.push(program);

        return okRun();
      },
      root: tmpdir(),
    });

    expect(report.proven).toBe(false);
    expect(report.reason).toBe("The change has no regression test.");
    expect(calls).toEqual([]);
  });
});
