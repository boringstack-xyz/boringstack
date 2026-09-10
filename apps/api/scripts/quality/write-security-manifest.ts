#!/usr/bin/env bun
/**
 * Regenerates the per-case expectations in `security-spec/findings.json` from
 * an actual run.
 *
 * Expectations are a baseline, and baselines are recorded rather than typed by
 * hand. The point is that the diff is reviewable: if this flips a case from
 * `assertion-fail` to `pass`, someone fixed something — or a test stopped
 * testing — and that shows up in review instead of being absorbed silently.
 *
 * Never run this just to turn a red check green. Read the diff.
 *
 * Usage: bun run scripts/quality/write-security-manifest.ts
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { parseJUnit, type CaseExpectation } from "./security-manifest-lib";

const API_ROOT = resolve(import.meta.dirname, "..", "..");
const MANIFEST = join(API_ROOT, "security-spec", "findings.json");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isUnknownArray = (value: unknown): value is unknown[] =>
  Array.isArray(value);

const runSuite = async (reportPath: string): Promise<void> => {
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

  await new Response(proc.stderr).text();
  await proc.exited;
};

const outDir = mkdtempSync(join(tmpdir(), "bs-security-write-"));
const reportPath = join(outDir, "report.xml");

try {
  await runSuite(reportPath);

  if (!existsSync(reportPath)) {
    throw new Error("the spec suite produced no report; is the stack up?");
  }

  const observed = parseJUnit(readFileSync(reportPath, "utf8"));
  const parsed: unknown = await Bun.file(MANIFEST).json();

  if (!isRecord(parsed) || !isUnknownArray(parsed.findings)) {
    throw new TypeError("findings.json has no findings array");
  }

  /*
   * Narrowed by inspection rather than asserted: this script rewrites the
   * file, so a malformed manifest should stop it rather than be papered over.
   */
  const findings = parsed.findings.map((entry: unknown) => {
    if (!isRecord(entry) || typeof entry.file !== "string") {
      throw new TypeError("a findings entry has no file");
    }

    const cases: Record<string, CaseExpectation> = {};

    for (const observation of observed.filter(
      (candidate) => candidate.file === entry.file
    )) {
      cases[observation.name] =
        observation.outcome === "passed" ? "pass" : "assertion-fail";
    }

    return { ...entry, cases };
  });

  await Bun.write(
    MANIFEST,
    `${JSON.stringify({ ...parsed, findings }, null, 2)}\n`
  );

  const total = findings.reduce(
    (sum, finding) => sum + Object.keys(finding.cases).length,
    0
  );

  console.log(
    `security-manifest: wrote ${total} case expectations across ` +
      `${findings.length} findings — review the diff`
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
