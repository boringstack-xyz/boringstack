#!/usr/bin/env bun
/**
 * Static checks for files ESLint can't parse as JavaScript:
 *
 *   bun run lint:meta
 *   bun run lint:meta --list-rules
 *   bun run lint:meta:verify
 *
 * Rule catalog: scripts/lint-meta/RULES.md
 *
 * Opt-in: `LINT_META_TOUCHED_BASE=<git-ref>` enables touch-tests-too.
 *
 * Exits non-zero on any violation. Run is part of `bun run check`.
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { buildContext } from "./context";
import { META_RULES } from "./registry";
import { printRuleCatalog, runMetaRules, runMetaRulesAsync } from "./runner";
import { checkDependencyPairs } from "./rules/supply-chain/no-overlapping-libs";
import { checkExactDependencyVersions } from "./rules/supply-chain/package-json-exact-deps";
import { checkPackageOverrideParity } from "./rules/supply-chain/package-override-parity";
import { checkSharedToolVersionParity } from "./rules/supply-chain/shared-tool-version-parity";
import { checkEslintConfigNoWarn } from "./rules/config/eslint-config-no-warn";
import { checkEslintOverridePathsExist } from "./rules/config/eslint-override-paths-exist";
import { checkTsconfigIncludePathsExist } from "./rules/config/tsconfig-include-paths-exist";
import { checkEnvSchemaDrift } from "./rules/env/env-cascade-drift";
import { checkNoDirectProcessEnv } from "./rules/env/no-direct-process-env";
import { checkGeneratedArtifactContracts } from "./rules/artifacts/generated-artifact-contract";
import { checkDockerfileBaseImageShaPin } from "./rules/ci/dockerfile-base-image-sha-pin";
import { checkEnginePinParity } from "./rules/ci/engine-pin-parity";
import { checkWorkflowConcurrencyExplicit } from "./rules/ci/github-actions-concurrency-explicit";
import { checkWorkflowExpressionSyntax } from "./rules/ci/github-actions-expression-syntax";
import { checkWorkflowServiceImageDigestPin } from "./rules/ci/github-actions-service-image-digest-pin";
import { checkWorkflowShas } from "./rules/ci/github-actions-permissions";
import { checkWorkflowTimeouts } from "./rules/ci/github-actions-timeout-required";
import { checkPrePushParity } from "./rules/ci/pre-push-ci-parity";
import { checkCanonicalHelpersSingleHome } from "./rules/source-text/canonical-helpers-single-home";
import { checkForbiddenText } from "./rules/source-text/forbidden-text";
import { checkNoRawRoleLiterals } from "./rules/source-text/no-raw-role-literals";
import { checkLogicFilesHaveTests } from "./rules/testing/logic-files-require-test-sibling";
import { checkRouteFilesHaveTests } from "./rules/testing/routes-require-test-sibling";
import { checkTouchedTests } from "./rules/testing/touch-tests-too";

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
    ...(verifyMode ? await runMetaRulesAsync(META_RULES, ctx) : []),
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
export { parseTypeboxEnvSchemaKeys as parseEnvSchemaKeys } from "./parsers/typebox-env-schema";
export {
  checkCanonicalHelpersSingleHome,
  checkDependencyPairs,
  checkDockerfileBaseImageShaPin,
  checkEnginePinParity,
  checkExactDependencyVersions,
  checkEslintConfigNoWarn,
  checkEslintOverridePathsExist,
  checkEnvSchemaDrift,
  checkForbiddenText,
  checkGeneratedArtifactContracts,
  checkLogicFilesHaveTests,
  checkNoDirectProcessEnv,
  checkNoRawRoleLiterals,
  checkPackageOverrideParity,
  checkPrePushParity,
  checkRouteFilesHaveTests,
  checkSharedToolVersionParity,
  checkTouchedTests,
  checkTsconfigIncludePathsExist,
  checkWorkflowConcurrencyExplicit,
  checkWorkflowExpressionSyntax,
  checkWorkflowServiceImageDigestPin,
  checkWorkflowShas,
  checkWorkflowTimeouts,
};
