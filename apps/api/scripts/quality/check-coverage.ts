#!/usr/bin/env bun
/*
 * Coverage gate. Runs `bun test --coverage` and fails when the whole-suite
 * line / function rate dips below the floor. Bun 1.3.10's bunfig-level
 * `coverageThreshold` is documented but not enforced, so we parse the
 * text report ourselves and exit non-zero on regression.
 *
 * The threshold is a ratchet, not a wishlist — it sits a few points
 * below the current measured rate so a small slip triggers the alarm.
 * Raise it as coverage climbs; never lower it to silence a regression.
 */
import { spawnSync } from "node:child_process";

const MIN_LINE = 0.65;
const MIN_FUNCTION = 0.7;
const MAX_TEST_OUTPUT_BUFFER_BYTES = 64 * 1024 * 1024;

const FORBIDDEN_OUTPUT = [
  /^\{"level":"WARN"/u,
  /^warn: /u,
  /^\[WARN\]/u,
  /^Unsupported engine:/u,
] as const;

const ALLOWED_WARNING_LINES = [
  /^warn: \[exact-mirror\] TypeBox's TypeCompiler is required to use Union$/u,
] as const;

interface ICoverageResult {
  linePct: number;
  functionPct: number;
}

const runCoverage = (): {
  combined: string;
  exitCode: number;
  spawnError?: Error;
} => {
  /*
   * Bun emits the coverage table on stderr; the test result on stdout.
   * Capture both into the same buffer so the gate's row-parser sees the
   * table, and stream the buffer to the user verbatim at the end.
   */
  const result = spawnSync("bun", ["test", "--coverage"], {
    encoding: "utf8",
    maxBuffer: MAX_TEST_OUTPUT_BUFFER_BYTES,
    env: {
      ...process.env,
      NODE_ENV: "test",
      LOG_LEVEL: "error",
      NODE_NO_WARNINGS: "1",
    },
  });

  return {
    combined: result.stdout + result.stderr,
    exitCode: result.status ?? 1,
    spawnError: result.error,
  };
};

const parseAllFilesRow = (output: string): ICoverageResult | null => {
  const row = output
    .split("\n")
    .find((line) => /^\s*All files\s*\|/.test(line));

  if (row === undefined) {
    return null;
  }

  const parts = row.split("|").map((segment) => segment.trim());
  const functionPct = parseFloat(parts[1] ?? "");
  const linePct = parseFloat(parts[2] ?? "");

  if (Number.isNaN(linePct) || Number.isNaN(functionPct)) {
    return null;
  }

  return { linePct: linePct / 100, functionPct: functionPct / 100 };
};

const formatPct = (value: number): string => `${(value * 100).toFixed(2)}%`;

const { combined, exitCode, spawnError } = runCoverage();

process.stdout.write(combined);

if (spawnError !== undefined) {
  console.error(
    `\n[check-coverage] bun test --coverage did not complete: ${spawnError.message}`
  );
  process.exit(1);
}

const warningLines = combined
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.length > 0)
  .filter((line) => FORBIDDEN_OUTPUT.some((pattern) => pattern.test(line)))
  .filter(
    (line) => !ALLOWED_WARNING_LINES.some((pattern) => pattern.test(line))
  );

if (warningLines.length > 0) {
  console.error(
    `\n[test:clean] ${String(warningLines.length)} forbidden warning line(s):\n`
  );

  for (const line of warningLines.slice(0, 20)) {
    console.error(`  ${line}`);
  }

  process.exit(1);
}

if (exitCode !== 0) {
  process.exit(exitCode);
}

const coverage = parseAllFilesRow(combined);

if (coverage === null) {
  console.error(
    "[check-coverage] could not locate the 'All files' row in the coverage report"
  );
  process.exit(1);
}

const lineOk = coverage.linePct >= MIN_LINE;
const functionOk = coverage.functionPct >= MIN_FUNCTION;

if (!lineOk || !functionOk) {
  console.error(
    `\n[check-coverage] coverage below threshold:` +
      `\n  lines:     ${formatPct(coverage.linePct)} (min ${formatPct(MIN_LINE)})${lineOk ? " ok" : " FAIL"}` +
      `\n  functions: ${formatPct(coverage.functionPct)} (min ${formatPct(MIN_FUNCTION)})${functionOk ? " ok" : " FAIL"}` +
      `\n\nTo raise: add tests for under-covered surfaces (queues / SSE / web push / setup).` +
      `\nTo lower the threshold: do not. Treat the gate as a ratchet.`
  );
  process.exit(1);
}

console.log(
  `\n[check-coverage] coverage gate passed: ${formatPct(coverage.linePct)} lines, ${formatPct(coverage.functionPct)} functions`
);
