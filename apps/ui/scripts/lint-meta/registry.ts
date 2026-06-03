import { generatedArtifactContractRule } from "./rules/artifacts/generated-artifact-contract";
import { modulepreloadSizeLimitRule } from "./rules/artifacts/modulepreload-size-limit";
import { dockerfileBaseImageShaPinRule } from "./rules/ci/dockerfile-base-image-sha-pin";
import { enginePinParityRule } from "./rules/ci/engine-pin-parity";
import { githubActionsBunCacheRule } from "./rules/ci/github-actions-bun-cache";
import { githubActionsConcurrencyExplicitRule } from "./rules/ci/github-actions-concurrency-explicit";
import { githubActionsExpressionSyntaxRule } from "./rules/ci/github-actions-expression-syntax";
import { githubActionsPermissionsRule } from "./rules/ci/github-actions-permissions";
import { githubActionsServiceImageDigestPinRule } from "./rules/ci/github-actions-service-image-digest-pin";
import { githubActionsTimeoutRequiredRule } from "./rules/ci/github-actions-timeout-required";
import { prePushCiParityRule } from "./rules/ci/pre-push-ci-parity";
import { tofuBootstrapHardeningRule } from "./rules/ci/tofu-bootstrap-hardening";
import { eslintConfigNoWarnRule } from "./rules/config/eslint-config-no-warn";
import { eslintPluginContractParityRule } from "./rules/config/eslint-plugin-contract-parity";
import { tsconfigIncludePathsExistRule } from "./rules/config/tsconfig-include-paths-exist";
import { envCascadeDriftRule } from "./rules/env/env-cascade-drift";
import { noDirectImportMetaEnvRule } from "./rules/env/no-direct-import-meta-env";
import { noSilentErrorSwallowRule } from "./rules/queries/no-silent-error-swallow";
import { canonicalHelpersSingleHomeRule } from "./rules/source-text/canonical-helpers-single-home";
import { docsNoRetiredCredentialsRule } from "./rules/source-text/docs-no-retired-credentials";
import { forbiddenTextRule } from "./rules/source-text/forbidden-text";
import { i18nLocaleKeysUsedRule } from "./rules/source-text/i18n-locale-keys-used";
import { noCrossRepoImportRule } from "./rules/source-text/no-cross-repo-import";
import { noRawRoleLiteralsRule } from "./rules/source-text/no-raw-role-literals";
import { scriptRawFetchRule } from "./rules/source-text/script-raw-fetch";
import { noOverlappingLibsRule } from "./rules/supply-chain/no-overlapping-libs";
import { packageJsonExactDepsRule } from "./rules/supply-chain/package-json-exact-deps";
import { logicFilesRequireTestSiblingRule } from "./rules/testing/logic-files-require-test-sibling";
import { skippedTestsNeedTrackingRule } from "./rules/testing/skipped-tests-need-tracking";
import { testFilesRequireSourceSiblingRule } from "./rules/testing/test-files-require-source-sibling";
import type { IMetaRule } from "./types";

export const META_RULES: readonly IMetaRule[] = [
  // --- supply-chain ---
  packageJsonExactDepsRule,
  noOverlappingLibsRule,
  // --- ci ---
  githubActionsPermissionsRule,
  githubActionsTimeoutRequiredRule,
  githubActionsBunCacheRule,
  githubActionsConcurrencyExplicitRule,
  githubActionsExpressionSyntaxRule,
  githubActionsServiceImageDigestPinRule,
  prePushCiParityRule,
  tofuBootstrapHardeningRule,
  enginePinParityRule,
  dockerfileBaseImageShaPinRule,
  // --- env ---
  envCascadeDriftRule,
  noDirectImportMetaEnvRule,
  // --- artifacts ---
  generatedArtifactContractRule,
  modulepreloadSizeLimitRule,
  // --- source-text ---
  canonicalHelpersSingleHomeRule,
  docsNoRetiredCredentialsRule,
  i18nLocaleKeysUsedRule,
  forbiddenTextRule,
  noCrossRepoImportRule,
  noRawRoleLiteralsRule,
  scriptRawFetchRule,
  noSilentErrorSwallowRule,
  // --- testing ---
  logicFilesRequireTestSiblingRule,
  testFilesRequireSourceSiblingRule,
  skippedTestsNeedTrackingRule,
  // --- config ---
  eslintConfigNoWarnRule,
  tsconfigIncludePathsExistRule,
  eslintPluginContractParityRule
];
