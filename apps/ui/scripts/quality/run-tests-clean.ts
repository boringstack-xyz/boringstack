#!/usr/bin/env tsx
/**
 * Runs vitest and fails when the suite prints warning noise to stdout/stderr.
 */
import { spawnSync } from "node:child_process";

const FORBIDDEN_OUTPUT = [
  /^\{"level":"WARN"/u,
  /^warn: /u,
  /^\[WARN\]/u,
  /^Unsupported engine:/u,
  /^Not implemented: HTMLFormElement/u
] as const;

const ALLOWED_WARNING_LINES = [
  /^Not implemented: HTMLFormElement's requestSubmit\(\) method$/u
] as const;

const vitestArgs = process.argv.slice(2);
const args = vitestArgs.length > 0 ? vitestArgs : ["run", "--coverage"];

const result = spawnSync("pnpm", ["exec", "vitest", ...args], {
  encoding: "utf8",
  env: {
    ...process.env,
    NODE_NO_WARNINGS: "1"
  }
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
