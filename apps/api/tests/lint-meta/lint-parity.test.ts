/*
 * Parity guard for the Oxlint migration. Every rule the merge gate depends on
 * must still report on a known violation, whichever linter runs it: Oxlint
 * (.oxlintrc.json) or the ESLint remainder (eslint.config.js).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FIXTURE = "tests/lint-meta/fixtures/lint-parity/violations.ts";
const PARITY_CONFIG = ".oxlintrc.parity.json";
const REMAINDER_CONFIG = "eslint.remainder.config.mjs";
const FULL_POLICY = join(APP_ROOT, "eslint.config.js");
const CONSOLE_PROBE_DIR = "src/__lint_parity__";
const CONSOLE_PROBE = `${CONSOLE_PROBE_DIR}/console.ts`;

/* Rules Oxlint runs, reported as `<plugin>/<rule>`. */
const OXLINT_RULES = [
  "eslint/curly",
  "eslint/eqeqeq",
  "eslint/no-debugger",
  "eslint/no-var",
  "eslint/prefer-const",
  "typescript/no-explicit-any",
  "typescript/no-non-null-assertion",
  "typescript/no-floating-promises",
  "typescript/no-unsafe-return",
  "typescript/no-unsafe-assignment",
  "typescript/no-unsafe-member-access",
  "typescript/no-unsafe-argument",
  "typescript/no-unsafe-call",
  "typescript/strict-boolean-expressions",
  "typescript/switch-exhaustiveness-check",
  "typescript/no-unnecessary-condition",
];

/* Rules kept in ESLint, reported with their ESLint rule ids. */
const ESLINT_RULES = [
  "@typescript-eslint/consistent-type-assertions",
  "@typescript-eslint/naming-convention",
  "padding-line-between-statements",
  "sonarjs/prefer-single-boolean-return",
  "prettier/prettier",
];

/* Tests are allowed console, so no-console is proven on a src/ probe instead. */
const SRC_SCOPED_OXLINT_RULES = ["eslint/no-console"];

type TJsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is TJsonRecord {
  return typeof value === "object" && value !== null;
}

function listOf(record: TJsonRecord, key: string): unknown[] {
  const value = record[key];

  return Array.isArray(value) ? value : [];
}

function textOf(record: TJsonRecord, key: string): string {
  const value = record[key];

  return typeof value === "string" ? value : "";
}

/* Oxlint reports `eslint(curly)` and `typescript(no-explicit-any)`; map them to `eslint/curly`. */
function normaliseOxlintCode(code: string): string {
  return code.replace(/^(\w[\w-]*)\((.*)\)$/u, "$1/$2");
}

function runOxlint(config: string, target: string): string[] {
  const result = spawnSync(
    join(APP_ROOT, "node_modules/.bin/oxlint"),
    ["--type-aware", "-c", config, "-f", "json", target],
    { cwd: APP_ROOT, encoding: "utf8" }
  );

  if (result.stdout === "") {
    throw new Error(`oxlint produced no JSON: ${result.stderr}`);
  }

  const parsed: unknown = JSON.parse(result.stdout);

  if (!isRecord(parsed)) {
    throw new Error("oxlint JSON has an unexpected shape");
  }

  return listOf(parsed, "diagnostics").flatMap((item) =>
    isRecord(item) ? [normaliseOxlintCode(textOf(item, "code"))] : []
  );
}

function runEslint(target: string): string[] {
  const result = spawnSync(
    join(APP_ROOT, "node_modules/.bin/eslint"),
    ["--no-ignore", "-c", REMAINDER_CONFIG, "-f", "json", target],
    { cwd: APP_ROOT, encoding: "utf8" }
  );

  if (result.stdout === "") {
    throw new Error(`eslint produced no JSON: ${result.stderr}`);
  }

  const parsed: unknown = JSON.parse(result.stdout);

  return listOf({ files: parsed }, "files").flatMap((file) =>
    isRecord(file)
      ? listOf(file, "messages").flatMap((message) =>
          isRecord(message) ? [textOf(message, "ruleId")] : []
        )
      : []
  );
}

describe("lint parity: Oxlint + ESLint remainder still report every required rule", () => {
  let oxlintFindings: string[] = [];
  let eslintFindings: string[] = [];

  beforeAll(() => {
    /* Oxlint's ignorePatterns would hide the fixture, so lint with a copy that has none. */
    const config: unknown = JSON.parse(
      readFileSync(join(APP_ROOT, ".oxlintrc.json"), "utf8")
    );

    if (!isRecord(config)) {
      throw new Error(".oxlintrc.json has an unexpected shape");
    }

    writeFileSync(
      join(APP_ROOT, PARITY_CONFIG),
      JSON.stringify({ ...config, ignorePatterns: [] })
    );
    mkdirSync(join(APP_ROOT, CONSOLE_PROBE_DIR), { recursive: true });
    writeFileSync(
      join(APP_ROOT, CONSOLE_PROBE),
      'export function logIt(): void {\n  console.log("probe");\n}\n'
    );
    oxlintFindings = runOxlint(PARITY_CONFIG, FIXTURE);
    eslintFindings = runEslint(FIXTURE);
  }, 120_000); /* Oxlint and ESLint over the fixture: seconds locally, longer on a busy runner. */

  afterAll(() => {
    rmSync(join(APP_ROOT, PARITY_CONFIG), { force: true });
    rmSync(join(APP_ROOT, CONSOLE_PROBE_DIR), { recursive: true, force: true });
  });

  test.each(OXLINT_RULES)("oxlint reports %s", (rule) => {
    expect(oxlintFindings).toContain(rule);
  });

  test.each(ESLINT_RULES)("eslint remainder reports %s", (rule) => {
    expect(eslintFindings).toContain(rule);
  });

  test.each(SRC_SCOPED_OXLINT_RULES)("oxlint reports %s under src/", (rule) => {
    expect(runOxlint(".oxlintrc.json", CONSOLE_PROBE)).toContain(rule);
  });
});

function isOff(value: unknown): boolean {
  const severity: unknown = Array.isArray(value) ? value.at(0) : value;

  return severity === "off" || severity === 0;
}

/* Oxlint names rules by plugin; map them to the ESLint names the full policy uses. */
function toEslintName(oxName: string): string {
  if (oxName.startsWith("eslint/")) {
    return oxName.slice("eslint/".length);
  }

  if (oxName.startsWith("typescript/")) {
    return `@typescript-eslint/${oxName.slice("typescript/".length)}`;
  }

  if (oxName === "react/exhaustive-deps" || oxName === "react/rules-of-hooks") {
    return `react-hooks/${oxName.slice("react/".length)}`;
  }

  return oxName;
}

async function loadConfigBlocks(file: string): Promise<unknown[]> {
  const mod: unknown = await import(file);

  if (!isRecord(mod)) {
    throw new Error(`${file} has no default export`);
  }

  const blocks: unknown = mod.default;

  if (!Array.isArray(blocks)) {
    throw new Error(`${file} does not default-export a config array`);
  }

  return blocks.map((block: unknown) => block);
}

function ruleEntries(blocks: unknown[]): [string, unknown][] {
  return blocks.flatMap((block) =>
    isRecord(block) && isRecord(block.rules) ? Object.entries(block.rules) : []
  );
}

describe("lint coverage: every rule the full policy enables is enforced by Oxlint or the remainder", () => {
  test("no enabled rule of eslint.config.js is dropped by the split", async () => {
    const enabled = ruleEntries(await loadConfigBlocks(FULL_POLICY))
      .filter(([, value]) => !isOff(value))
      .map(([name]) => name);
    const remainder = ruleEntries(
      await loadConfigBlocks(join(APP_ROOT, REMAINDER_CONFIG))
    ).map(([name]) => name);
    const oxlintConfig: unknown = JSON.parse(
      readFileSync(join(APP_ROOT, ".oxlintrc.json"), "utf8")
    );

    if (!isRecord(oxlintConfig)) {
      throw new Error(".oxlintrc.json has an unexpected shape");
    }

    const oxlintSections = [oxlintConfig, ...listOf(oxlintConfig, "overrides")];
    const oxlint = oxlintSections.flatMap((section) =>
      isRecord(section) && isRecord(section.rules)
        ? Object.keys(section.rules).map(toEslintName)
        : []
    );
    const covered = new Set([...remainder, ...oxlint]);
    const missing = enabled.filter((name) => !covered.has(name));

    expect(missing).toEqual([]);
  });
});
