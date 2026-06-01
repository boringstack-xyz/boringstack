import { generatedArtifactContractRule } from "./rules/artifacts/generated-artifact-contract";
import { modulepreloadSizeLimitRule } from "./rules/artifacts/modulepreload-size-limit";
import { enginePinParityRule } from "./rules/ci/engine-pin-parity";
import { githubActionsPermissionsRule } from "./rules/ci/github-actions-permissions";
import { prePushCiParityRule } from "./rules/ci/pre-push-ci-parity";
import { eslintConfigNoWarnRule } from "./rules/config/eslint-config-no-warn";
import { envCascadeDriftRule } from "./rules/env/env-cascade-drift";
import { noDirectImportMetaEnvRule } from "./rules/env/no-direct-import-meta-env";
import { noSilentErrorSwallowRule } from "./rules/queries/no-silent-error-swallow";
import { canonicalHelpersSingleHomeRule } from "./rules/source-text/canonical-helpers-single-home";
import { forbiddenTextRule } from "./rules/source-text/forbidden-text";
import { noCrossRepoImportRule } from "./rules/source-text/no-cross-repo-import";
import { noRawRoleLiteralsRule } from "./rules/source-text/no-raw-role-literals";
import { scriptRawFetchRule } from "./rules/source-text/script-raw-fetch";
import { noOverlappingLibsRule } from "./rules/supply-chain/no-overlapping-libs";
import { packageJsonExactDepsRule } from "./rules/supply-chain/package-json-exact-deps";
import { logicFilesRequireTestSiblingRule } from "./rules/testing/logic-files-require-test-sibling";
import { skippedTestsNeedTrackingRule } from "./rules/testing/skipped-tests-need-tracking";
import type { IMetaRule } from "./types";

export const META_RULES: readonly IMetaRule[] = [
  // --- supply-chain ---
  packageJsonExactDepsRule,
  noOverlappingLibsRule,
  // --- ci ---
  githubActionsPermissionsRule,
  prePushCiParityRule,
  enginePinParityRule,
  // --- env ---
  envCascadeDriftRule,
  noDirectImportMetaEnvRule,
  // --- artifacts ---
  generatedArtifactContractRule,
  modulepreloadSizeLimitRule,
  // --- source-text ---
  canonicalHelpersSingleHomeRule,
  forbiddenTextRule,
  noCrossRepoImportRule,
  noRawRoleLiteralsRule,
  scriptRawFetchRule,
  noSilentErrorSwallowRule,
  // --- testing ---
  logicFilesRequireTestSiblingRule,
  skippedTestsNeedTrackingRule,
  // --- config ---
  eslintConfigNoWarnRule
];
