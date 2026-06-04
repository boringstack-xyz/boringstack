import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import type { IMetaRule, IViolation } from "../../types";

/*
 * The stack's whole defense model is "lint as a contract": defects are
 * prevented by these rules, not by review. A rule that is never unit-tested
 * can silently rot into a no-op (a refactor makes it return [] and every
 * defect in its class ships unnoticed) — and a check function that is not
 * re-exported from cli.ts cannot be imported by a test at all. So the
 * guardrails must themselves be guarded: every rule module
 * (`export const …Rule`) must (1) expose a `check<Name>` function, (2)
 * re-export it from cli.ts, and (3) be referenced by name in a
 * `describe("check<Name>", …)` or `test("check<Name> …")` block in the
 * lint-meta test file (the suite uses both conventions). This rule was added
 * after several api and ui rules had drifted into being
 * registered-but-untested.
 */
const RULE_EXPORT_RE = /export const \w+Rule\b/u;
const CHECK_FN_RE = /export function (check\w+)/gu;
const EXPORT_BLOCK_RE = /export(?:\s+type)?\s*\{([^}]*)\}/gu;
const EXPORT_DECL_RE = /export\s+(?:async\s+)?(?:function|const)\s+(\w+)/gu;
const RULE_ID = "lint-meta-rules-self-covered";

function collectRuleFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];

  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }

  for (const entry of entries) {
    const full = join(dir, entry);

    let isDir: boolean;

    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }

    if (isDir) {
      out.push(...collectRuleFiles(full));
      continue;
    }

    if (full.endsWith(".ts") && !full.endsWith(".test.ts")) {
      out.push(full);
    }
  }

  return out;
}

function collectExportedNames(source: string): Set<string> {
  const names = new Set<string>();

  // Brace re-exports: `export { checkX }` and `export { checkX } from "…"`.
  for (const block of source.matchAll(EXPORT_BLOCK_RE)) {
    for (const raw of (block[1] ?? "").split(",")) {
      const name = raw
        .trim()
        .split(/\s+as\s+/u)[0]
        ?.trim();

      if (name !== undefined && name !== "") {
        names.add(name);
      }
    }
  }

  // Inline declaration exports (a check fn declared and exported in-file).
  for (const match of source.matchAll(EXPORT_DECL_RE)) {
    if (match[1] !== undefined) {
      names.add(match[1]);
    }
  }

  return names;
}

export function checkLintMetaRulesSelfCovered(root: string): IViolation[] {
  const violations: IViolation[] = [];
  const lintMetaDir = join(root, "scripts", "lint-meta");
  const cliPath = join(lintMetaDir, "cli.ts");
  const testPath = join(root, "tests", "lint-meta", "lint-meta.test.ts");

  // Only runs in an app that ships the lint-meta engine and its test file.
  if (!existsSync(cliPath) || !existsSync(testPath)) {
    return violations;
  }

  const cliExports = collectExportedNames(readFileSync(cliPath, "utf8"));
  const testContent = readFileSync(testPath, "utf8");

  for (const file of collectRuleFiles(join(lintMetaDir, "rules"))) {
    const source = readFileSync(file, "utf8");

    // Skip shared data/helper modules that register no rule.
    if (!RULE_EXPORT_RE.test(source)) {
      continue;
    }

    const checkFns = [...source.matchAll(CHECK_FN_RE)]
      .map((match) => match[1])
      .filter((name): name is string => name !== undefined);

    if (checkFns.length === 0) {
      violations.push({
        file,
        rule: RULE_ID,
        message:
          "Rule module exports a `*Rule` but no `check<Name>` function — expose the check function so it can be unit-tested directly."
      });
      continue;
    }

    for (const fn of checkFns) {
      if (!cliExports.has(fn)) {
        violations.push({
          file,
          rule: RULE_ID,
          message: `\`${fn}\` is not re-exported from scripts/lint-meta/cli.ts — add it to the export block so tests and consumers can import it.`
        });
      }

      /*
       * The suite tests rules either as a dedicated describe block or as a
       * test() whose name begins with the check fn under an umbrella describe.
       */
      const testRef = new RegExp(`(?:describe|test)\\("${fn}["\\s]`, "u");

      if (!testRef.test(testContent)) {
        violations.push({
          file,
          rule: RULE_ID,
          message: `\`${fn}\` is not referenced by any \`describe("${fn}", …)\` or \`test("${fn} …")\` block in tests/lint-meta/lint-meta.test.ts — an untested guardrail can silently regress to a no-op.`
        });
      }
    }
  }

  return violations;
}

/** Every lint-meta rule must re-export its check fn from cli.ts and be unit-tested. */
export const lintMetaRulesSelfCoveredRule: IMetaRule = {
  id: RULE_ID,
  category: "testing",
  description:
    "Every lint-meta rule module must re-export its check function from cli.ts and carry a describe() test block — the guardrails must themselves be guarded.",
  run({ root }) {
    return checkLintMetaRulesSelfCovered(root);
  }
};
