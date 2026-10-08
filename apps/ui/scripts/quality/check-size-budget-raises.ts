#!/usr/bin/env tsx
/**
 * Bundle budget gate. A limit in .size-limit.json may only go up with a reason.
 *
 * An entry is "raised" when its limit grows against the base, and "new" when the
 * base does not have it. Each one needs a reason line in budgets.md that is new
 * or changed relative to the base, so an old reason cannot cover a later raise.
 * Decreases and unchanged entries need nothing.
 *
 * Base: `--base <ref>`, else the merge-base of origin/main and HEAD. When that
 * merge-base is HEAD itself (a push to main), HEAD~1 is used instead.
 * Head: the working tree, so the same check runs locally and in CI.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SIZE_LIMIT_FILE = ".size-limit.json";
export const BUDGET_LEDGER_FILE = "budgets.md";
export const MIN_REASON_LENGTH = 10;

const EMPTY_TREE_SHA = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
const UNIT_BYTES = new Map<string, number>([
  ["b", 1],
  ["kb", 1024],
  ["mb", 1024 * 1024]
]);
const LIMIT_PATTERN = /^\s*(\d+(?:\.\d+)?)\s*(B|KB|MB)\s*$/iu;
const LEDGER_LINE_PATTERN = /^- `([^`]+)`:\s*(.+)$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseLimitBytes(limit: string): number {
  const match = LIMIT_PATTERN.exec(limit);
  const value = match?.[1];
  const unit = match?.[2];
  const multiplier =
    unit === undefined ? undefined : UNIT_BYTES.get(unit.toLowerCase());

  if (value === undefined || multiplier === undefined) {
    throw new Error(`unsupported size-limit limit "${limit}"`);
  }

  return Math.round(Number(value) * multiplier);
}

/** Entry name to limit in bytes. Entries without a string limit are not budgets. */
export function parseSizeLimit(json: string): Map<string, number> {
  const parsed: unknown = JSON.parse(json);

  if (!Array.isArray(parsed)) {
    throw new Error(`${SIZE_LIMIT_FILE} must be a JSON array`);
  }

  const limits = new Map<string, number>();

  for (const entry of parsed) {
    if (
      isRecord(entry) &&
      typeof entry.name === "string" &&
      typeof entry.limit === "string"
    ) {
      limits.set(entry.name, parseLimitBytes(entry.limit));
    }
  }

  return limits;
}

/** Entry name to reason, from lines shaped as "- `<entry name>`: <reason>". */
export function parseLedger(markdown: string): Map<string, string> {
  const reasons = new Map<string, string>();

  for (const line of markdown.split("\n")) {
    const match = LEDGER_LINE_PATTERN.exec(line.trim());
    const name = match?.[1];
    const reason = match?.[2]?.trim();

    if (name !== undefined && reason !== undefined) {
      reasons.set(name, reason);
    }
  }

  return reasons;
}

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(2)} KB`;
}

export interface IBudgetSnapshot {
  readonly limits: ReadonlyMap<string, number>;
  readonly reasons: ReadonlyMap<string, string>;
}

export function findBudgetRaiseViolations(
  base: IBudgetSnapshot,
  head: IBudgetSnapshot
): string[] {
  const violations: string[] = [];

  for (const [name, headBytes] of head.limits) {
    const baseBytes = base.limits.get(name);

    if (baseBytes !== undefined && headBytes <= baseBytes) {
      continue;
    }

    const change =
      baseBytes === undefined
        ? `new entry at ${formatKb(headBytes)}`
        : `raised from ${formatKb(baseBytes)} to ${formatKb(headBytes)}`;
    const reason = head.reasons.get(name);

    if (reason === undefined || reason.length < MIN_REASON_LENGTH) {
      violations.push(
        `"${name}": ${change} needs a reason line in ${BUDGET_LEDGER_FILE}: - \`${name}\`: <why>`
      );
    } else if (reason === base.reasons.get(name)) {
      violations.push(
        `"${name}": ${change}; its reason in ${BUDGET_LEDGER_FILE} is unchanged from the base, write one for this change`
      );
    }
  }

  return violations;
}

const UI_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function git(args: readonly string[]): string | null {
  try {
    return execFileSync("git", args, {
      cwd: UI_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
  } catch {
    return null;
  }
}

/** Contents of a file at a git ref, or null when the file does not exist there. */
function readAtRef(ref: string, file: string): string | null {
  return git(["show", `${ref}:./${file}`]);
}

function resolveBase(explicit: string | undefined): string {
  if (explicit !== undefined) {
    return explicit;
  }

  const mergeBase = git(["merge-base", "origin/main", "HEAD"])?.trim();

  if (mergeBase === undefined || mergeBase === "") {
    throw new Error(
      "cannot resolve origin/main; fetch it or pass --base <ref>"
    );
  }

  if (mergeBase !== git(["rev-parse", "HEAD"])?.trim()) {
    return mergeBase;
  }

  return (
    git(["rev-parse", "--verify", "--quiet", "HEAD~1"])?.trim() ??
    EMPTY_TREE_SHA
  );
}

function readBaseSnapshot(ref: string): IBudgetSnapshot {
  const limitJson = readAtRef(ref, SIZE_LIMIT_FILE);
  const ledger = readAtRef(ref, BUDGET_LEDGER_FILE);

  return {
    limits: limitJson === null ? new Map() : parseSizeLimit(limitJson),
    reasons: ledger === null ? new Map() : parseLedger(ledger)
  };
}

function readHeadSnapshot(): IBudgetSnapshot {
  const limitPath = resolve(UI_ROOT, SIZE_LIMIT_FILE);
  const ledgerPath = resolve(UI_ROOT, BUDGET_LEDGER_FILE);
  const ledger = existsSync(ledgerPath) ? readFileSync(ledgerPath, "utf8") : "";

  return {
    limits: parseSizeLimit(readFileSync(limitPath, "utf8")),
    reasons: parseLedger(ledger)
  };
}

function main(): void {
  const args = process.argv.slice(2);
  const baseIndex = args.indexOf("--base");
  const explicitBase = baseIndex === -1 ? undefined : args[baseIndex + 1];

  if (baseIndex !== -1 && explicitBase === undefined) {
    throw new Error("--base needs a git ref");
  }

  const base = resolveBase(explicitBase);
  const violations = findBudgetRaiseViolations(
    readBaseSnapshot(base),
    readHeadSnapshot()
  );

  if (violations.length > 0) {
    console.error(
      `[check:size-budget] ${String(violations.length)} budget raise(s) without a reason (base ${base.slice(0, 12)}):\n`
    );

    for (const violation of violations) {
      console.error(`  - ${violation}`);
    }

    process.exit(1);
  }

  console.log(
    `[check:size-budget] no budget raised or added without a reason (base ${base.slice(0, 12)}).`
  );
}

const isEntrypoint =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  main();
}
