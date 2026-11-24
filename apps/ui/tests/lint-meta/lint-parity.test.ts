/*
 * Parity guard for the Oxlint migration. Every rule the merge gate depends on
 * must still report on a known violation, whichever linter runs it: Oxlint
 * (.oxlintrc.json) or the ESLint remainder (eslint.config.mjs).
 */
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FIXTURE = "tests/lint-meta/fixtures/lint-parity/violations.tsx";
const PARITY_CONFIG = ".oxlintrc.parity.json";
const REMAINDER_CONFIG = "eslint.remainder.config.mjs";
const FULL_POLICY = join(APP_ROOT, "eslint.config.mjs");
/* Each config load spawns Node and imports the whole policy; slow under a loaded machine. */
const LOAD_TIMEOUT_MS = 60_000;

/* Rule ids as the merge gate names them (Oxlint names are mapped to ESLint ids). */
const REQUIRED_RULES = [
  "@typescript-eslint/no-explicit-any",
  "@typescript-eslint/no-floating-promises",
  "@typescript-eslint/no-meaningless-void-operator",
  "curly",
  "eqeqeq",
  "no-restricted-globals",
  "nonblock-statement-body-position",
  "padding-line-between-statements",
  "prefer-const",
  "promise/catch-or-return",
  "react-hooks/exhaustive-deps",
  "react-refresh/only-export-components"
];

/* Oxlint reports `eslint(curly)`, `typescript(no-explicit-any)`, `react(exhaustive-deps)`. */
function normalise(code: string): string {
  const name = code.replace(/^(\w[\w-]*)\((.*)\)$/u, "$1/$2");

  if (name.startsWith("eslint/")) {
    return name.slice("eslint/".length);
  }

  if (name.startsWith("typescript/")) {
    return `@typescript-eslint/${name.slice("typescript/".length)}`;
  }

  if (name === "react/exhaustive-deps" || name === "react/rules-of-hooks") {
    return `react-hooks/${name.slice("react/".length)}`;
  }

  return name;
}

function lintFindings(): Set<string> {
  const oxlint = spawnSync(
    join(APP_ROOT, "node_modules/.bin/oxlint"),
    ["--type-aware", "-c", PARITY_CONFIG, "-f", "json", FIXTURE],
    { cwd: APP_ROOT, encoding: "utf8" }
  );
  const eslint = spawnSync(
    join(APP_ROOT, "node_modules/.bin/eslint"),
    ["--no-ignore", "-c", REMAINDER_CONFIG, "-f", "json", FIXTURE],
    { cwd: APP_ROOT, encoding: "utf8" }
  );

  if (oxlint.stdout === "" || eslint.stdout === "") {
    throw new Error(`lint produced no JSON: ${oxlint.stderr}${eslint.stderr}`);
  }

  const oxRules = (
    JSON.parse(oxlint.stdout) as { diagnostics: { code: string }[] }
  ).diagnostics.map((d) => normalise(d.code));
  const eslintRules = (
    JSON.parse(eslint.stdout) as { messages: { ruleId: string | null }[] }[]
  ).flatMap((f) => f.messages.map((m) => m.ruleId ?? ""));

  return new Set([...oxRules, ...eslintRules]);
}

describe("lint parity: Oxlint + ESLint remainder still report every required rule", () => {
  let findings = new Set<string>();

  beforeAll(() => {
    /* Oxlint's ignorePatterns would hide the fixture, so lint with a copy that has none. */
    const config = JSON.parse(
      readFileSync(join(APP_ROOT, ".oxlintrc.json"), "utf8")
    ) as { ignorePatterns: string[] };

    config.ignorePatterns = [];
    writeFileSync(join(APP_ROOT, PARITY_CONFIG), JSON.stringify(config));
    findings = lintFindings();
  }, 120_000); /* Oxlint and ESLint over the fixture: seconds locally, longer on a busy runner. */

  afterAll(() => {
    rmSync(join(APP_ROOT, PARITY_CONFIG), { force: true });
  });

  it.each(REQUIRED_RULES)("reports %s", (rule) => {
    expect(findings).toContain(rule);
  });
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

/*
 * Loads a flat config in a plain Node process: vitest rewrites import.meta.url, which the config's
 * dictionary reads depend on. Returns [ruleName, isOff] for every rule in every block.
 */
function loadRuleStates(file: string): [string, boolean][] {
  const script = `
    const mod = await import(process.env.CONFIG_FILE);
    const states = [];
    for (const block of mod.default) {
      for (const [name, value] of Object.entries(block?.rules ?? {})) {
        const severity = Array.isArray(value) ? value[0] : value;
        states.push([name, severity === "off" || severity === 0]);
      }
    }
    process.stdout.write(JSON.stringify(states));
  `;
  const result = spawnSync("node", ["--input-type=module", "-e", script], {
    cwd: APP_ROOT,
    encoding: "utf8",
    env: { ...process.env, CONFIG_FILE: file }
  });

  if (result.stdout === "") {
    throw new Error(`could not load ${file}: ${result.stderr}`);
  }

  const parsed: unknown = JSON.parse(result.stdout);

  if (!Array.isArray(parsed)) {
    throw new Error(`${file} produced no rule list`);
  }

  return parsed.flatMap((entry) =>
    Array.isArray(entry) &&
    typeof entry[0] === "string" &&
    typeof entry[1] === "boolean"
      ? [[entry[0], entry[1]]]
      : []
  );
}

describe("lint coverage: every rule the full policy enables is enforced by Oxlint or the remainder", () => {
  it(
    "drops no enabled rule of eslint.config.mjs in the split",
    () => {
      const enabled = loadRuleStates(FULL_POLICY)
        .filter(([, off]) => !off)
        .map(([name]) => name);
      const remainder = loadRuleStates(join(APP_ROOT, REMAINDER_CONFIG)).map(
        ([name]) => name
      );
      const oxlintConfig: unknown = JSON.parse(
        readFileSync(join(APP_ROOT, ".oxlintrc.json"), "utf8")
      );

      if (!isRecord(oxlintConfig)) {
        throw new Error(".oxlintrc.json has an unexpected shape");
      }

      const overrides: unknown = oxlintConfig.overrides;
      const sections: unknown[] = [
        oxlintConfig,
        ...(Array.isArray(overrides) ? overrides : [])
      ];
      const oxlint = sections.flatMap((section) =>
        isRecord(section) && isRecord(section.rules)
          ? Object.keys(section.rules).map(toEslintName)
          : []
      );
      const covered = new Set([...remainder, ...oxlint]);

      expect(enabled.filter((name) => !covered.has(name))).toEqual([]);
    },
    LOAD_TIMEOUT_MS
  );
});
