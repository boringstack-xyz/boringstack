#!/usr/bin/env tsx
/**
 * Static checks for files ESLint can't parse as JavaScript:
 *
 *   bun run lint:meta
 *   bun run lint:meta --list-rules
 *   bun run lint:meta --verify
 *
 * Rule catalog: scripts/lint-meta/RULES.md
 *
 * Exits non-zero on any violation. Run is part of `bun run check`.
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { buildContext } from "./context";
import { META_RULES } from "./registry";
import { checkForbiddenText as checkForbiddenTextWithRoot } from "./rules/source-text/forbidden-text";
import { printRuleCatalog, runMetaRules, runMetaRulesAsync } from "./runner";

const ROOT = resolve(process.cwd());

async function main(): Promise<void> {
  if (process.argv.includes("--list-rules")) {
    printRuleCatalog(META_RULES);

    return;
  }

  const verifyMode = process.argv.includes("--verify");
  const ctx = buildContext(ROOT);
  const syncViolations = runMetaRules(META_RULES, ctx);

  if (verifyMode) {
    console.log("[lint:meta] Verifying action SHAs against github.com…");
  }

  const violations = [
    ...syncViolations,
    ...(verifyMode ? await runMetaRulesAsync(META_RULES, ctx) : [])
  ];

  if (violations.length === 0) {
    console.log(
      verifyMode
        ? "[lint:meta] No violations. All action SHAs resolve."
        : "[lint:meta] No violations."
    );

    return;
  }

  console.error(`[lint:meta] ${String(violations.length)} violation(s):\n`);

  for (const v of violations) {
    console.error(`  ${v.file}`);
    console.error(`    ${v.rule}: ${v.message}\n`);
  }

  process.exit(1);
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void main();
}

export type { IViolation } from "./types";
export { collectSourceFiles, findWorkflows } from "./context";
export { parseDotenvKeys } from "./parsers/dotenv";
export { checkDependencyPairs } from "./rules/supply-chain/no-overlapping-libs";
export { checkPackageJson } from "./rules/supply-chain/package-json-exact-deps";
export { checkWorkflow } from "./rules/ci/github-actions-permissions";
export { checkUiEnvCascadeDrift } from "./rules/env/env-cascade-drift";
export { checkNoDirectImportMetaEnv } from "./rules/env/no-direct-import-meta-env";
export { checkNoSilentErrorSwallow } from "./rules/queries/no-silent-error-swallow";
export { checkCanonicalHelpersSingleHome } from "./rules/source-text/canonical-helpers-single-home";
export { checkNoCrossRepoImports } from "./rules/source-text/no-cross-repo-import";
export { checkNoRawRoleLiterals } from "./rules/source-text/no-raw-role-literals";
export { checkScriptRawFetch } from "./rules/source-text/script-raw-fetch";

/** @param file Absolute path to the source file under test */
export function checkForbiddenText(
  file: string
): ReturnType<typeof checkForbiddenTextWithRoot> {
  return checkForbiddenTextWithRoot(file, ROOT);
}
