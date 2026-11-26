import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { IRunResult } from "../fleet/process";
import { EMPTY_LEDGER } from "../fleet/findings.utils";
import { EXIT } from "../result";
import type { ILanesDeps } from "./index";
import {
  capRun,
  digestRun,
  reviewBodyRun,
  riskRun,
  scopeRun,
  triagePlanRun,
  triageRun,
} from "./index";

const noRun = (): IRunResult => ({ status: 0, stdout: "", stderr: "" });
const deps = (stdin: string, run = noRun): ILanesDeps => ({
  run,
  now: () => Date.parse("2026-11-23T12:00:00Z"),
  stdin: () => stdin,
});
const tmp = (): string => mkdtempSync(join(tmpdir(), "lanes-cmd-"));

describe("lanes commands", () => {
  test("risk writes the level and the merge decision for the workflow", () => {
    const dir = tmp();
    const body = join(dir, "body.md");
    const out = join(dir, "out.txt");

    writeFileSync(
      body,
      "**Risk: low** (copy)\n\n## Review\n\nVerdict: approve\nRisk: low\n"
    );

    const outcome = riskRun(
      [`--body=${body}`, "--reviewed", `--out=${out}`],
      deps("apps/ui/src/pages/Home.tsx\n")
    );

    expect(outcome.code).toBe(EXIT.ok);
    expect(readFileSync(out, "utf8")).toBe("level=medium\nmerge=true\n");
    expect(riskRun([], deps("")).code).toBe(EXIT.failed);
    expect(
      riskRun(
        [`--body=${body}`, "--reviewed", "--ceiling=none", `--out=${out}`],
        deps("README.md\n")
      ).code
    ).toBe(EXIT.ok);
    expect(readFileSync(out, "utf8")).toBe("level=low\nmerge=false\n");
    riskRun([`--body=${body}`, `--out=${out}`], deps("README.md\n"));
    expect(readFileSync(out, "utf8")).toBe("level=low\nmerge=false\n");
  });

  test("scope passes a change inside the lane and fails one outside it", () => {
    expect(
      scopeRun(
        ["triage"],
        deps("apps/api/src/a.ts\napps/api/tests/a.test.ts\n")
      ).code
    ).toBe(EXIT.ok);
    expect(scopeRun(["triage"], deps(".github/workflows/x.yml\n")).code).toBe(
      EXIT.failed
    );
    expect(scopeRun(["writer"], deps("")).code).toBe(EXIT.failed);
  });

  test("cap reads gh pr rows from stdin and returns the decision as data", () => {
    const outcome = capRun(["triage"], deps("[]"));

    expect(outcome.code).toBe(EXIT.ok);
    expect(outcome.data).toEqual({
      run: true,
      slots: 1,
      result: "",
      reason: "open 0/2, merged in 7 days 0/7",
    });
  });

  test("review-body writes the verdict into the record's Review section", () => {
    const dir = tmp();
    const bodyFile = join(dir, "body.md");
    const reviewFile = join(dir, "review.md");
    const out = join(dir, "out.md");

    writeFileSync(bodyFile, "# Verification\n\n## Review\n\nPending.\n");
    writeFileSync(reviewFile, "Approved.");

    expect(reviewBodyRun([bodyFile, reviewFile, out]).code).toBe(EXIT.ok);
    expect(readFileSync(out, "utf8")).toContain("## Review\n\nApproved.");
  });

  test("triage-plan refuses a plan that does not match its findings and writes the comment otherwise", () => {
    const dir = tmp();
    const findingsFile = join(dir, "findings.json");
    const planFile = join(dir, "plan.json");
    const out = join(dir, "comment.md");

    writeFileSync(
      findingsFile,
      JSON.stringify([
        {
          id: "a",
          service: "api",
          signature: "boom",
          count: 1,
          example: "boom",
          filed: null,
        },
      ])
    );
    writeFileSync(
      planFile,
      JSON.stringify({
        items: [
          { finding: "b", problem: "boom", cause: "x", outcome: "noise" },
        ],
        fix: null,
      })
    );

    expect(triagePlanRun([planFile, findingsFile]).code).toBe(EXIT.failed);

    writeFileSync(
      planFile,
      JSON.stringify({
        items: [
          { finding: "a", problem: "boom", cause: "x", outcome: "noise" },
        ],
        fix: null,
      })
    );

    expect(triagePlanRun([planFile, findingsFile, `--out=${out}`]).code).toBe(
      EXIT.ok
    );
    expect(readFileSync(out, "utf8")).toContain("no change needed");
  });

  test("triage with --dispatch sends the batch to the triage workflow", () => {
    const sharedDir = tmp();
    const ledger = {
      ...EMPTY_LEDGER,
      findings: [
        {
          id: "f1",
          service: "api",
          event: null,
          signature: "database connection refused",
          count: 4,
          firstSeen: "2026-11-22T00:00:00Z",
          lastSeen: "2026-11-23T00:00:00Z",
          example: "database connection refused",
          muted: false,
          filed: null,
        },
      ],
    };

    writeFileSync(join(sharedDir, "findings.json"), JSON.stringify(ledger));

    const calls: string[][] = [];
    const context = {
      root: sharedDir,
      sharedDir,
      stateDir: sharedDir,
    };
    const outcome = triageRun(["--dispatch"], context, {
      ...deps(""),
      run: (program, args) => {
        calls.push([program, ...args]);

        return noRun();
      },
    });

    expect(outcome.code).toBe(EXIT.ok);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.slice(0, 4)).toEqual([
      "gh",
      "workflow",
      "run",
      "agent-triage.yml",
    ]);
    expect(calls[0]?.[5]).toStartWith("findings=");
  });

  test("triage with no ledger is blocked, not passed", () => {
    const sharedDir = tmp();
    const context = {
      root: sharedDir,
      sharedDir,
      stateDir: sharedDir,
    };

    expect(triageRun([], context, deps("")).code).toBe(EXIT.blocked);
  });

  test("digest reads pull requests and runs from gh and writes the Markdown", () => {
    const dir = tmp();
    const out = join(dir, "digest.md");
    const run = (): IRunResult => ({ status: 0, stdout: "[]", stderr: "" });

    expect(
      digestRun([out, "--now=2026-11-23T12:00:00Z"], { ...deps(""), run }).code
    ).toBe(EXIT.ok);
    expect(readFileSync(out, "utf8")).toContain(
      "# Agent digest, week ending 2026-11-23"
    );
  });
});
