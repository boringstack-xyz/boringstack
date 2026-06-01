import { generatedArtifactContractRule } from "./rules/artifacts/generated-artifact-contract";
import { enginePinParityRule } from "./rules/ci/engine-pin-parity";
import { githubActionsPermissionsRule } from "./rules/ci/github-actions-permissions";
import { prePushCiParityRule } from "./rules/ci/pre-push-ci-parity";
import { eslintConfigNoWarnRule } from "./rules/config/eslint-config-no-warn";
import { envCascadeDriftRule } from "./rules/env/env-cascade-drift";
import { noDirectProcessEnvRule } from "./rules/env/no-direct-process-env";
import { canonicalHelpersSingleHomeRule } from "./rules/source-text/canonical-helpers-single-home";
import { forbiddenTextRule } from "./rules/source-text/forbidden-text";
import { noRawRoleLiteralsRule } from "./rules/source-text/no-raw-role-literals";
import { noOverlappingLibsRule } from "./rules/supply-chain/no-overlapping-libs";
import { packageJsonExactDepsRule } from "./rules/supply-chain/package-json-exact-deps";
import { sharedToolVersionParityRule } from "./rules/supply-chain/shared-tool-version-parity";
import { logicFilesRequireTestSiblingRule } from "./rules/testing/logic-files-require-test-sibling";
import { routesRequireTestSiblingRule } from "./rules/testing/routes-require-test-sibling";
import { skippedTestsNeedTrackingRule } from "./rules/testing/skipped-tests-need-tracking";
import { touchTestsTooRule } from "./rules/testing/touch-tests-too";
import type { IMetaRule } from "./types";

export const META_RULES: readonly IMetaRule[] = [
  packageJsonExactDepsRule,
  noOverlappingLibsRule,
  sharedToolVersionParityRule,
  githubActionsPermissionsRule,
  prePushCiParityRule,
  enginePinParityRule,
  envCascadeDriftRule,
  noDirectProcessEnvRule,
  generatedArtifactContractRule,
  forbiddenTextRule,
  canonicalHelpersSingleHomeRule,
  noRawRoleLiteralsRule,
  routesRequireTestSiblingRule,
  logicFilesRequireTestSiblingRule,
  skippedTestsNeedTrackingRule,
  touchTestsTooRule,
  eslintConfigNoWarnRule,
];
