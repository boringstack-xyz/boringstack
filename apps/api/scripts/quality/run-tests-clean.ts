#!/usr/bin/env bun
/**
 * Runs bun test and fails when the suite prints warning noise to stdout/stderr.
 */
import { spawnSync } from "node:child_process";

const FORBIDDEN_OUTPUT = [
  /^\{"level":"WARN"/u,
  /^warn: /u,
  /^\[WARN\]/u,
  /^Unsupported engine:/u,
] as const;

const ALLOWED_WARNING_LINES = [
  /^warn: \[exact-mirror\] TypeBox's TypeCompiler is required to use Union$/u,
] as const;

const bunArgs = ["test", ...process.argv.slice(2)];

const result = spawnSync("bun", bunArgs, {
  encoding: "utf8",
  env: {
    ...process.env,
    NODE_ENV: "test",
    LOG_LEVEL: "error",
    NODE_NO_WARNINGS: "1",
  },
});

const stdout = result.stdout;
const stderr = result.stderr;
const combined = stdout + stderr;

process.stdout.write(stdout);
process.stderr.write(stderr);

const violations = combined
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.length > 0)
  .filter((line) => FORBIDDEN_OUTPUT.some((pattern) => pattern.test(line)))
  .filter(
    (line) => !ALLOWED_WARNING_LINES.some((pattern) => pattern.test(line))
  );

if (violations.length > 0) {
  console.error(
    `\n[test:clean] ${String(violations.length)} forbidden warning line(s):\n`
  );

  for (const line of violations.slice(0, 20)) {
    console.error(`  ${line}`);
  }

  process.exit(1);
}

process.exit(result.status ?? 1);
