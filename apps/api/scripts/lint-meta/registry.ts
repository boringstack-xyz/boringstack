import { generatedArtifactContractRule } from "./rules/artifacts/generated-artifact-contract";
import { dockerfileBaseImageShaPinRule } from "./rules/ci/dockerfile-base-image-sha-pin";
import { enginePinParityRule } from "./rules/ci/engine-pin-parity";
import { githubActionsBunCacheRule } from "./rules/ci/github-actions-bun-cache";
import { githubActionsConcurrencyExplicitRule } from "./rules/ci/github-actions-concurrency-explicit";
import { githubActionsExpressionSyntaxRule } from "./rules/ci/github-actions-expression-syntax";
import { githubActionsPathsFilterParityRule } from "./rules/ci/github-actions-paths-filter-parity";
import { githubActionsPipInstallPinnedRule } from "./rules/ci/github-actions-pip-install-pinned";
import { githubActionsPermissionsRule } from "./rules/ci/github-actions-permissions";
import { githubActionsSecurityNoCancelRule } from "./rules/ci/github-actions-security-no-cancel";
import { githubActionsServiceImageDigestPinRule } from "./rules/ci/github-actions-service-image-digest-pin";
import { githubActionsTimeoutRequiredRule } from "./rules/ci/github-actions-timeout-required";
import { prePushCiParityRule } from "./rules/ci/pre-push-ci-parity";
import { securityScannerVersionParityRule } from "./rules/ci/security-scanner-version-parity";
import { tofuBootstrapHardeningRule } from "./rules/ci/tofu-bootstrap-hardening";
import { eslintBanTypeAssertionsRule } from "./rules/config/eslint-ban-type-assertions";
import { eslintConfigNoWarnRule } from "./rules/config/eslint-config-no-warn";
import { eslintPluginContractParityRule } from "./rules/config/eslint-plugin-contract-parity";
import { eslintOverridePathsExistRule } from "./rules/config/eslint-override-paths-exist";
import { tsconfigIncludePathsExistRule } from "./rules/config/tsconfig-include-paths-exist";
import { envCascadeDriftRule } from "./rules/env/env-cascade-drift";
import { noDirectProcessEnvRule } from "./rules/env/no-direct-process-env";
import { canonicalHelpersSingleHomeRule } from "./rules/source-text/canonical-helpers-single-home";
import { docsNoRetiredCredentialsRule } from "./rules/source-text/docs-no-retired-credentials";
import { externalClientTimeoutRule } from "./rules/source-text/external-client-timeout";
import { forbiddenTextRule } from "./rules/source-text/forbidden-text";
import { noRawRoleLiteralsRule } from "./rules/source-text/no-raw-role-literals";
import { noOverlappingLibsRule } from "./rules/supply-chain/no-overlapping-libs";
import { packageJsonExactDepsRule } from "./rules/supply-chain/package-json-exact-deps";
import { packageOverrideParityRule } from "./rules/supply-chain/package-override-parity";
import { sharedToolVersionParityRule } from "./rules/supply-chain/shared-tool-version-parity";
import { lintMetaRulesSelfCoveredRule } from "./rules/testing/lint-meta-rules-self-covered";
import { logicFilesRequireTestSiblingRule } from "./rules/testing/logic-files-require-test-sibling";
import { routesRequireTestSiblingRule } from "./rules/testing/routes-require-test-sibling";
import { skippedTestsNeedTrackingRule } from "./rules/testing/skipped-tests-need-tracking";
import { touchTestsTooRule } from "./rules/testing/touch-tests-too";
import type { IMetaRule } from "./types";

export const META_RULES: readonly IMetaRule[] = [
  packageJsonExactDepsRule,
  noOverlappingLibsRule,
  packageOverrideParityRule,
  sharedToolVersionParityRule,
  githubActionsPermissionsRule,
  githubActionsTimeoutRequiredRule,
  githubActionsBunCacheRule,
  githubActionsConcurrencyExplicitRule,
  githubActionsPathsFilterParityRule,
  githubActionsPipInstallPinnedRule,
  githubActionsSecurityNoCancelRule,
  githubActionsExpressionSyntaxRule,
  githubActionsServiceImageDigestPinRule,
  prePushCiParityRule,
  securityScannerVersionParityRule,
  tofuBootstrapHardeningRule,
  enginePinParityRule,
  dockerfileBaseImageShaPinRule,
  envCascadeDriftRule,
  noDirectProcessEnvRule,
  generatedArtifactContractRule,
  forbiddenTextRule,
  canonicalHelpersSingleHomeRule,
  docsNoRetiredCredentialsRule,
  externalClientTimeoutRule,
  noRawRoleLiteralsRule,
  routesRequireTestSiblingRule,
  logicFilesRequireTestSiblingRule,
  lintMetaRulesSelfCoveredRule,
  skippedTestsNeedTrackingRule,
  touchTestsTooRule,
  eslintConfigNoWarnRule,
  eslintBanTypeAssertionsRule,
  eslintOverridePathsExistRule,
  tsconfigIncludePathsExistRule,
  eslintPluginContractParityRule,
];
