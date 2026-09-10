#!/usr/bin/env bun
/**
 * Reconciles `security-spec/findings.json` against a real run of the security
 * spec suite.
 *
 * The suite is expected to be red: each `proven` finding must have at least
 * one test failing on an assertion, because the defect it describes is still
 * live. That inverts the usual meaning of a green run, which creates several
 * ways to be silently wrong: a finding quietly fixed and still reported as
 * outstanding, a test that stopped running, a fixture that throws before it
 * reaches the behaviour under test.
 *
 * The reconciliation rules live in `security-manifest-lib.ts` and are unit
 * tested in `tests/scripts/security-manifest.test.ts`. This file only runs the
 * suite and reports.
 *
 * Usage: bun run scripts/quality/check-security-manifest.ts
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  parseJUnit,
  reconcile,
  type CaseExpectation,
  type IFinding,
  type IManifest,
} from "./security-manifest-lib";

const API_ROOT = resolve(import.meta.dirname, "..", "..");
const SPEC_DIR = join(API_ROOT, "security-spec");
const MANIFEST = join(SPEC_DIR, "findings.json");

/*
 * `Array.isArray` narrows `unknown` to `any[]`, which then infects every
 * element access. This narrows to `unknown[]` instead.
 */
const isUnknownArray = (value: unknown): value is unknown[] =>
  Array.isArray(value);

const parseManifest = (value: unknown): IManifest => {
  if (typeof value !== "object" || value === null) {
    throw new TypeError("findings.json is not an object");
  }

  const record: Record<string, unknown> = { ...value };
  const rawFindings = record.findings;

  if (!isUnknownArray(rawFindings)) {
    throw new TypeError("findings.json has no `findings` array");
  }

  const findings = rawFindings.map((entry: unknown, index): IFinding => {
    if (typeof entry !== "object" || entry === null) {
      throw new TypeError(`findings[${index}] is not an object`);
    }

    const row: Record<string, unknown> = { ...entry };
    const { id, severity, status, file, title, cases } = row;

    if (
      typeof id !== "string" ||
      typeof severity !== "string" ||
      typeof file !== "string" ||
      typeof title !== "string" ||
      typeof cases !== "object" ||
      cases === null
    ) {
      throw new TypeError(`findings[${index}] has a malformed field`);
    }

    const parsedCases: Record<string, CaseExpectation> = {};

    const caseEntries: [string, unknown][] = Object.entries({ ...cases });

    for (const [name, expectation] of caseEntries) {
      if (expectation !== "assertion-fail" && expectation !== "pass") {
        throw new TypeError(
          `findings[${index}].cases["${name}"] is ${String(expectation)}`
        );
      }

      parsedCases[name] = expectation;
    }

    if (status !== "proven" && status !== "fixed" && status !== "refuted") {
      throw new TypeError(`findings[${index}].status is ${String(status)}`);
    }

    return { id, severity, status, file, title, cases: parsedCases };
  });

  const reviewedCommit = record.reviewedCommit;

  return {
    reviewedCommit: typeof reviewedCommit === "string" ? reviewedCommit : "",
    findings,
  };
};

const report = (problems: string[]): never => {
  console.error(`security-manifest: ${problems.length} problem(s)\n`);

  for (const problem of problems) {
    console.error(`  ✗ ${problem}`);
  }

  process.exit(1);
};

const manifest = parseManifest(await Bun.file(MANIFEST).json());

/* ------------------------------------- the files must exist and be mapped */

const structural: string[] = [];

for (const finding of manifest.findings) {
  if (finding.status === "refuted") {
    continue;
  }

  if (!existsSync(join(SPEC_DIR, finding.file))) {
    structural.push(`${finding.id}: ${finding.file} is missing`);
  }
}

const listed = new Set(manifest.findings.map((finding) => finding.file));

for (const path of new Bun.Glob("*.test.ts").scanSync({ cwd: SPEC_DIR })) {
  if (!listed.has(path)) {
    structural.push(
      `${path} exists but no finding in findings.json points at it`
    );
  }
}

if (structural.length > 0) {
  report(structural);
}

/* ----------------------------------------------------------- run the suite */

const outDir = mkdtempSync(join(tmpdir(), "bs-security-manifest-"));
const reportPath = join(outDir, "report.xml");

try {
  const proc = Bun.spawn(
    [
      "bun",
      "test",
      "security-spec",
      "--reporter=junit",
      `--reporter-outfile=${reportPath}`,
    ],
    {
      cwd: API_ROOT,
      env: { ...process.env, NODE_ENV: "test", SECURITY_SPEC: "true" },
      stdout: "pipe",
      stderr: "pipe",
    }
  );

  const stderr = await new Response(proc.stderr).text();

  await proc.exited;

  /*
   * The exit code is deliberately NOT the signal: an expected-red run exits
   * non-zero by design. What matters is whether a machine-readable report was
   * produced, and what is in it.
   */
  const runCompleted = existsSync(reportPath);
  const xml = runCompleted ? readFileSync(reportPath, "utf8") : "";
  const cases = parseJUnit(xml);

  if (runCompleted && cases.length === 0) {
    console.error(stderr.slice(-2000));
    report(["the spec suite produced an empty report"]);
  }

  const problems = reconcile({ manifest, cases, runCompleted });

  if (problems.length > 0) {
    report(problems);
  }

  const failures = cases.filter((entry) => entry.outcome === "failed").length;
  const expected = manifest.findings.reduce(
    (total, finding) => total + Object.keys(finding.cases).length,
    0
  );

  console.log(
    `security-manifest: ok — ${manifest.findings.length} findings, ` +
      `${expected} expected cases all matched (${failures} failing on ` +
      `assertions, ${cases.length - failures} passing)`
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
