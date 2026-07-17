import { describe, expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { execSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";

import { renderRulesMd } from "../../scripts/lint-meta/generate-rules-md";
import {
  checkAuditLogReadAccountScoped,
  checkCanonicalHelpersSingleHome,
  checkDependencyPairs,
  checkDockerfileBaseImageShaPin,
  checkEnginePinParity,
  checkEnvSchemaDrift,
  checkEslintBanTypeAssertions,
  checkEslintConfigNoWarn,
  checkEslintOverridePathsExist,
  checkEslintPluginContractParity,
  checkExactDependencyVersions,
  checkExternalClientTimeouts,
  checkForbiddenText,
  checkLogicFilesHaveTests,
  checkNoDirectProcessEnv,
  checkPrePushScannerParity,
  checkRouteFilesHaveTests,
  checkSecurityScannerVersionParity,
  checkTouchedTests,
  checkTsconfigIncludePathsExist,
  checkWorkflowBunCache,
  checkWorkflowConcurrencyExplicit,
  checkWorkflowExpressionSyntax,
  checkWorkflowPathsFilterParity,
  checkWorkflowPipInstallPinned,
  checkWorkflowRunnerPinned,
  checkWorkflowSecurityNoCancel,
  checkWorkflowServiceImageDigestPin,
  checkWorkflowShas,
  checkWorkflowTimeouts,
  collectSourceFiles,
  findWorkflows,
  checkGeneratedArtifactContracts,
  checkNoRawRoleLiterals,
  checkSchemaEnumFieldConsistency,
  inconsistentEnumFields,
  checkPackageOverrideParity,
  checkPrePushParity,
  checkSharedToolVersionParity,
  checkTofuBootstrapHardening,
  checkDocsNoRetiredCredentials,
  checkLintMetaRulesSelfCovered,
  checkSkippedTestsHaveTracking,
} from "../../scripts/lint-meta/cli";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const GUARD_TMP_PREFIX = "lint-meta-guard-";
const SAST_WORKFLOW_NAME = "apps-api-security-sast.yml";
const GITLEAKS_PIN_ENV = 'env:\n  GITLEAKS_VERSION: "8.30.1"\n';
const RULE_SELF_COVERED = "lint-meta-rules-self-covered";

function writeNamedWorkflow(
  root: string,
  name: string,
  content: string
): string {
  const file = join(root, name);

  writeFileSync(file, content);

  return file;
}

describe("checkSharedToolVersionParity", () => {
  test("flags a shared tool pinned to different versions across apps", () => {
    const violations = checkSharedToolVersionParity(
      join(FIXTURES, "shared-tools-drift")
    );

    expect(violations.map((row) => row.rule)).toContain(
      "shared-tool-version-parity"
    );
    expect(violations.some((row) => row.message.includes("eslint"))).toBe(true);
  });

  test("flags drift in prefix-matched @boring-stack-pkg plugins", () => {
    const violations = checkSharedToolVersionParity(
      join(FIXTURES, "shared-tools-drift")
    );

    expect(
      violations.some((row) =>
        row.message.includes("@boring-stack-pkg/eslint-plugin-demo")
      )
    ).toBe(true);
  });

  test("passes when every app pins shared tools to the same version", () => {
    const violations = checkSharedToolVersionParity(
      join(FIXTURES, "shared-tools-clean")
    );

    expect(violations).toEqual([]);
  });
});

describe("checkPackageOverrideParity", () => {
  test("flags a sibling resolving an overridden package without a mirror", () => {
    const violations = checkPackageOverrideParity(
      join(FIXTURES, "override-parity-drift")
    );

    expect(
      violations.some(
        (row) =>
          row.file.includes("app-b") && row.message.includes("mirror the pin")
      )
    ).toBe(true);
  });

  test("flags an override the app's own lockfile does not resolve", () => {
    const violations = checkPackageOverrideParity(
      join(FIXTURES, "override-parity-drift")
    );

    expect(
      violations.some(
        (row) =>
          row.file.includes("app-c") &&
          row.message.includes("run `bun install`")
      )
    ).toBe(true);
  });

  test("flags an override with no `//overrides` documentation entry", () => {
    const violations = checkPackageOverrideParity(
      join(FIXTURES, "override-parity-drift")
    );

    expect(
      violations.some(
        (row) =>
          row.file.includes("app-a") &&
          row.message.includes("no `//overrides` entry")
      )
    ).toBe(true);
  });

  test("passes when overrides are applied and siblings resolve the same version", () => {
    const violations = checkPackageOverrideParity(
      join(FIXTURES, "override-parity-clean")
    );

    expect(violations).toEqual([]);
  });
});

describe("checkForbiddenText", () => {
  test("flags inline lint suppression directive", () => {
    const violations = checkForbiddenText(
      join(FIXTURES, "source-text/inline-disable-comment.ts")
    );

    expect(violations.map((row) => row.rule)).toContain(
      "no-inline-lint-disable"
    );
  });

  test("flags TS suppression directive", () => {
    const violations = checkForbiddenText(
      join(FIXTURES, "source-text/ts-suppression.ts")
    );

    expect(violations.map((row) => row.rule)).toContain("no-ts-ignore");
  });

  test("clean file produces no violations", () => {
    const violations = checkForbiddenText(
      join(FIXTURES, "source-text/clean.ts")
    );

    expect(violations).toEqual([]);
  });
});

describe("checkCanonicalHelpersSingleHome", () => {
  test("flags a duplicate `normalizeEmail` declaration outside the canonical file", () => {
    const violations = checkCanonicalHelpersSingleHome(
      join(FIXTURES, "source-text/canonical-helpers-duplicate.ts"),
      join(FIXTURES, "..", "..", "..")
    );

    expect(violations.map((row) => row.rule)).toContain(
      "canonical-helpers-single-home"
    );
  });

  test("the canonical file itself is allowed to declare the helper", () => {
    /*
     * Build a virtual root one directory above the fixture so the
     * fixture's path equals the registered canonical_src. The fixture
     * mimics the shape of the canonical declaration; if the rule
     * incorrectly flagged its own home, this test would catch it.
     */
    const violations = checkCanonicalHelpersSingleHome(
      join(FIXTURES, "source-text/clean.ts"),
      join(FIXTURES, "..", "..", "..")
    );

    expect(violations).toEqual([]);
  });
});

describe("checkEslintConfigNoWarn", () => {
  test('flags "warn" severity in eslint config', () => {
    const violations = checkEslintConfigNoWarn(
      join(FIXTURES, "eslint-config-warn")
    );

    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]?.rule).toBe("eslint-config-no-warn");
  });

  test("clean config produces no violations", () => {
    const violations = checkEslintConfigNoWarn(
      join(FIXTURES, "eslint-config-clean")
    );

    expect(violations).toEqual([]);
  });
});

describe("checkEslintBanTypeAssertions", () => {
  const runOn = (body: string) => {
    const root = mkdtempSync(join(tmpdir(), GUARD_TMP_PREFIX));

    try {
      writeFileSync(join(root, "eslint.config.mjs"), body);

      return checkEslintBanTypeAssertions(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  };

  const NEVER =
    'export default [{ rules: { "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "never" }] } }];\n';

  test("passes when assertionStyle is pinned to never with no rule-off", () => {
    expect(runOn(NEVER)).toEqual([]);
  });

  test('flags assertionStyle "as" — the exact drift that let casts ship', () => {
    const violations = runOn(
      'export default [{ rules: { "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "as", objectLiteralTypeAssertions: "never" }] } }];\n'
    );

    expect(violations.some((v) => v.message.includes("still permits"))).toBe(
      true
    );
    expect(violations[0]?.rule).toBe("eslint-ban-type-assertions");
  });

  test('flags assertionStyle "angle-bracket"', () => {
    const violations = runOn(
      'export default [{ rules: { "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "angle-bracket" }] } }];\n'
    );

    expect(violations.some((v) => v.message.includes("still permits"))).toBe(
      true
    );
  });

  test("flags a config that never pins the rule to never at all", () => {
    const violations = runOn("export default [{ rules: {} }];\n");

    expect(
      violations.some((v) =>
        v.message.includes('pinned to `assertionStyle: "never"`')
      )
    ).toBe(true);
  });

  test("accepts single-quoted assertionStyle 'never'", () => {
    expect(
      runOn(
        "export default [{ rules: { '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }] } }];\n"
      )
    ).toEqual([]);
  });

  test("flags the rule turned off without a justification marker", () => {
    const violations = runOn(
      `${NEVER.trimEnd()}\nexport const extra = [{ files: ["x.ts"], rules: { "@typescript-eslint/consistent-type-assertions": "off" } }];\n`
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.message).toContain("without justification");
  });

  test("allows the rule off when a same-line exemption marker is present", () => {
    const violations = runOn(
      `${NEVER.trimEnd()}\nexport const extra = [{ files: ["x.ts"], rules: { "@typescript-eslint/consistent-type-assertions": "off" } }]; // eslint-meta-allow-assertion-exemption: genuine boundary\n`
    );

    expect(violations).toEqual([]);
  });

  test("still flags off when the marker is on a different line (must be same-line)", () => {
    const violations = runOn(
      `${NEVER.trimEnd()}\n// eslint-meta-allow-assertion-exemption: wrong place\nexport const extra = [{ rules: { "@typescript-eslint/consistent-type-assertions": "off" } }];\n`
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.message).toContain("without justification");
  });

  test("the live api eslint config is compliant (0 violations)", () => {
    const appRoot = join(FIXTURES, "..", "..", "..");

    expect(checkEslintBanTypeAssertions(appRoot)).toEqual([]);
  });
});

describe("checkEslintOverridePathsExist", () => {
  test("flags a literal override path that does not exist, ignores globs", () => {
    const root = mkdtempSync(join(tmpdir(), GUARD_TMP_PREFIX));

    try {
      mkdirSync(join(root, "tests"), { recursive: true });
      writeFileSync(join(root, "tests", "real.test.ts"), "// real\n");
      writeFileSync(
        join(root, "eslint.config.js"),
        [
          "export default [",
          "  {",
          '    files: ["tests/real.test.ts", "tests/missing.test.ts", "tests/**/*.test.ts"],',
          "  },",
          "];",
          "",
        ].join("\n")
      );

      const violations = checkEslintOverridePathsExist(root);

      expect(violations).toHaveLength(1);
      expect(violations[0]?.message).toContain("tests/missing.test.ts");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("passes when every literal override path exists", () => {
    const root = mkdtempSync(join(tmpdir(), GUARD_TMP_PREFIX));

    try {
      mkdirSync(join(root, "tests"), { recursive: true });
      writeFileSync(join(root, "tests", "real.test.ts"), "// real\n");
      writeFileSync(
        join(root, "eslint.config.js"),
        'export default [{ files: ["tests/real.test.ts"] }];\n'
      );

      const violations = checkEslintOverridePathsExist(root);

      expect(violations).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkDependencyPairs", () => {
  test("flags forbidden overlapping libs (react-hot-toast + sonner)", () => {
    const violations = checkDependencyPairs(
      join(FIXTURES, "package-overlap.json")
    );

    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]?.rule).toBe("no-overlapping-libs");
  });

  test("clean package.json produces no violations", () => {
    const violations = checkDependencyPairs(
      join(FIXTURES, "package-clean.json")
    );

    expect(violations).toEqual([]);
  });
});

describe("checkExactDependencyVersions", () => {
  test("flags dependency and devDependency ranges", () => {
    const violations = checkExactDependencyVersions(
      join(FIXTURES, "package-range.json")
    );

    expect(violations.map((row) => row.rule)).toEqual([
      "package-json-exact-deps",
      "package-json-exact-deps",
    ]);
  });

  test("allows exact dependency versions", () => {
    const violations = checkExactDependencyVersions(
      join(FIXTURES, "package-clean.json")
    );

    expect(violations).toEqual([]);
  });
});

describe("checkWorkflowShas", () => {
  test("flags unpinned actions/checkout@v4", () => {
    const workflows = findWorkflows(join(FIXTURES, "workflows-bad"));

    expect(workflows.length).toBeGreaterThan(0);

    const violations = workflows.flatMap(checkWorkflowShas);

    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]?.rule).toBe("github-actions-permissions");
  });

  test("40-char SHA passes", () => {
    const workflows = findWorkflows(join(FIXTURES, "workflows-good"));
    const violations = workflows.flatMap(checkWorkflowShas);

    expect(violations).toEqual([]);
  });

  test("flags id-token: write with no OIDC consumer", () => {
    const workflows = findWorkflows(
      join(FIXTURES, "workflows-id-token-unused")
    );
    const violations = workflows.flatMap(checkWorkflowShas);

    expect(violations.some((v) => v.message.includes("id-token: write"))).toBe(
      true
    );
  });

  test("allows id-token: write when a cosign step consumes it", () => {
    const workflows = findWorkflows(join(FIXTURES, "workflows-id-token-used"));
    const violations = workflows.flatMap(checkWorkflowShas);

    expect(violations.some((v) => v.message.includes("id-token: write"))).toBe(
      false
    );
  });
});

describe("checkWorkflowTimeouts", () => {
  test("flags a job missing timeout-minutes, exempts reusable-workflow calls", () => {
    const workflows = findWorkflows(join(FIXTURES, "workflows-no-timeout"));
    const violations = workflows.flatMap(checkWorkflowTimeouts);

    expect(violations).toHaveLength(1);
    expect(violations[0]?.rule).toBe("github-actions-timeout-required");
    expect(violations[0]?.message).toContain('"test"');
  });

  test("job with timeout-minutes passes", () => {
    const workflows = findWorkflows(join(FIXTURES, "workflows-good"));
    const violations = workflows.flatMap(checkWorkflowTimeouts);

    expect(violations).toEqual([]);
  });
});

describe("checkDockerfileBaseImageShaPin", () => {
  test("flags a FROM tag without a digest", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-dockerpin-"));

    try {
      writeFileSync(
        join(root, "Dockerfile.prod"),
        "FROM oven/bun:1.3.14-alpine AS builder\n"
      );

      const violations = checkDockerfileBaseImageShaPin(root);

      expect(violations.map((row) => row.rule)).toContain(
        "dockerfile-base-image-sha-pin"
      );
      expect(
        violations.some((row) =>
          row.message.includes("oven/bun:1.3.14-alpine (line 1)")
        )
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("passes digest-pinned images and skips earlier stage aliases", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-dockerpin-"));

    try {
      writeFileSync(
        join(root, "Dockerfile.prod"),
        [
          "FROM oven/bun:1.3.14-alpine@sha256:0000000000000000000000000000000000000000000000000000000000000000 AS builder",
          "FROM builder AS assets",
          "FROM oven/bun:1.3.14-alpine@sha256:0000000000000000000000000000000000000000000000000000000000000000 AS production",
          "",
        ].join("\n")
      );

      const violations = checkDockerfileBaseImageShaPin(root);

      expect(violations).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkWorkflowConcurrencyExplicit", () => {
  function writeWorkflow(root: string, content: string): string {
    const file = join(root, "wf.yml");

    writeFileSync(file, content);

    return file;
  }

  test("flags a concurrency block without cancel-in-progress", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-concurrency-"));

    try {
      const file = writeWorkflow(
        root,
        "concurrency:\n  group: x-${{ github.ref }}\n\njobs: {}\n"
      );

      const violations = checkWorkflowConcurrencyExplicit(file);

      expect(violations.map((row) => row.rule)).toContain(
        "github-actions-concurrency-explicit"
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("passes explicit cancel-in-progress and workflows without concurrency", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-concurrency-"));

    try {
      const explicit = writeWorkflow(
        root,
        "concurrency:\n  group: x-${{ github.ref }}\n  cancel-in-progress: false\n\njobs: {}\n"
      );

      expect(checkWorkflowConcurrencyExplicit(explicit)).toEqual([]);

      const none = writeWorkflow(root, "jobs: {}\n");

      expect(checkWorkflowConcurrencyExplicit(none)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkWorkflowPathsFilterParity", () => {
  test("flags push-only and filter-only path drift in both directions", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-filter-parity-"));

    try {
      const file = writeNamedWorkflow(
        root,
        "wf.yml",
        [
          "on:",
          "  push:",
          "    branches: [main]",
          "    paths:",
          '      - "apps/x/**"',
          '      - "setup.sh"',
          "  pull_request: {}",
          "",
          "jobs:",
          "  scan:",
          "    steps:",
          "      - uses: dorny/paths-filter@abc",
          "        with:",
          "          filters: |",
          "            code:",
          "              - 'apps/x/**'",
          "              - '.github/workflows/**'",
          "",
        ].join("\n")
      );

      const messages = checkWorkflowPathsFilterParity(file).map(
        (row) => row.message
      );

      expect(messages).toHaveLength(2);
      expect(messages.some((m) => m.includes("'setup.sh'"))).toBe(true);
      expect(messages.some((m) => m.includes("'.github/workflows/**'"))).toBe(
        true
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("passes glob-covered parity and skips workflows missing either list", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-filter-parity-"));

    try {
      const covered = writeNamedWorkflow(
        root,
        "wf.yml",
        [
          "on:",
          "  push:",
          "    branches: [main]",
          "    paths:",
          '      - "apps/x/**"',
          "      # comment between entries must not end the list",
          '      - ".github/workflows/wf.yml"',
          "  pull_request: {}",
          "",
          "jobs:",
          "  scan:",
          "    steps:",
          "      - uses: dorny/paths-filter@abc",
          "        with:",
          "          filters: |",
          "            code:",
          "              - 'apps/x/sub/**'",
          "              - 'apps/x/**'",
          "            other:",
          "              - '.github/workflows/wf.yml'",
          "",
        ].join("\n")
      );

      expect(checkWorkflowPathsFilterParity(covered)).toEqual([]);

      const pushOnly = writeNamedWorkflow(
        root,
        "push-only.yml",
        'on:\n  push:\n    paths:\n      - "apps/x/**"\n\njobs: {}\n'
      );

      expect(checkWorkflowPathsFilterParity(pushOnly)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkWorkflowPipInstallPinned", () => {
  test("flags pip install without a version pin", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-pip-pin-"));

    try {
      const file = writeNamedWorkflow(
        root,
        "wf.yml",
        "jobs:\n  lint:\n    steps:\n      - run: |\n          pip install --user yamllint\n"
      );

      const messages = checkWorkflowPipInstallPinned(file).map(
        (row) => row.message
      );

      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("'yamllint'");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("passes == pins, env-var pins, flags, and requirement files", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-pip-pin-"));

    try {
      const file = writeNamedWorkflow(
        root,
        "wf.yml",
        [
          "jobs:",
          "  lint:",
          "    steps:",
          "      - run: |",
          "          pip install --user yamllint==1.38.0",
          '          pip3 install "semgrep==${SEMGREP_VERSION}"',
          "          pip install -r requirements.txt",
          "",
        ].join("\n")
      );

      expect(checkWorkflowPipInstallPinned(file)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkWorkflowRunnerPinned", () => {
  test("flags floating *-latest runner labels", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-runner-pin-"));

    try {
      const file = writeNamedWorkflow(
        root,
        "wf.yml",
        "jobs:\n  build:\n    runs-on: ubuntu-latest\n    steps: []\n"
      );

      const messages = checkWorkflowRunnerPinned(file).map(
        (row) => row.message
      );

      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("ubuntu-latest");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("passes pinned OS versions and expression labels", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-runner-pin-"));

    try {
      const file = writeNamedWorkflow(
        root,
        "wf.yml",
        [
          "jobs:",
          "  build:",
          "    runs-on: ubuntu-24.04",
          "    steps: []",
          "  matrix:",
          "    runs-on: ${{ matrix.os }}",
          "    steps: []",
          "",
        ].join("\n")
      );

      expect(checkWorkflowRunnerPinned(file)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkWorkflowSecurityNoCancel", () => {
  test("flags a security workflow with cancel-in-progress: true", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-secnocancel-"));

    try {
      const file = writeNamedWorkflow(
        root,
        SAST_WORKFLOW_NAME,
        "concurrency:\n  group: x-${{ github.ref }}\n  cancel-in-progress: true\n\njobs: {}\n"
      );

      expect(
        checkWorkflowSecurityNoCancel(file).map((row) => row.rule)
      ).toEqual(["github-actions-security-no-cancel"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("passes a security workflow with cancel-in-progress: false", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-secnocancel-"));

    try {
      const file = writeNamedWorkflow(
        root,
        "infra-compose-security-secrets.yml",
        "concurrency:\n  group: x-${{ github.ref }}\n  cancel-in-progress: false\n\njobs: {}\n"
      );

      expect(checkWorkflowSecurityNoCancel(file)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("ignores non-security workflows that cancel in progress", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-secnocancel-"));

    try {
      const file = writeNamedWorkflow(
        root,
        "apps-api-ci.yml",
        "concurrency:\n  group: x-${{ github.ref }}\n  cancel-in-progress: true\n\njobs: {}\n"
      );

      expect(checkWorkflowSecurityNoCancel(file)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkSecurityScannerVersionParity", () => {
  test("flags a gitleaks version that drifts between workflows", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-scanver-"));

    try {
      const a = writeNamedWorkflow(
        root,
        "apps-api-security-secrets.yml",
        GITLEAKS_PIN_ENV
      );
      const b = writeNamedWorkflow(
        root,
        "apps-ui-security-secrets.yml",
        'env:\n  GITLEAKS_VERSION: "8.30.0"\n'
      );

      const violations = checkSecurityScannerVersionParity([a, b]);

      expect(violations.map((row) => row.rule)).toContain(
        "security-scanner-version-parity"
      );
      expect(violations.some((row) => row.message.includes("gitleaks"))).toBe(
        true
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("passes when gitleaks and semgrep pins agree across workflows", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-scanver-"));

    try {
      const digest = "@sha256:" + "a".repeat(64);
      const a = writeNamedWorkflow(
        root,
        "apps-api-security-secrets.yml",
        GITLEAKS_PIN_ENV
      );
      const b = writeNamedWorkflow(
        root,
        "apps-ui-security-secrets.yml",
        GITLEAKS_PIN_ENV
      );
      const c = writeNamedWorkflow(
        root,
        SAST_WORKFLOW_NAME,
        `jobs:\n  sast:\n    container: semgrep/semgrep:1.142.0${digest}\n`
      );
      const d = writeNamedWorkflow(
        root,
        "apps-ui-security-sast.yml",
        `jobs:\n  sast:\n    container: semgrep/semgrep:1.142.0${digest}\n`
      );

      expect(checkSecurityScannerVersionParity([a, b, c, d])).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkPrePushScannerParity", () => {
  function writePrePushSecurityScript(root: string, content: string): string {
    const dir = join(root, "scripts", "ci");

    mkdirSync(dir, { recursive: true });

    const file = join(dir, "pre-push-security.sh");

    writeFileSync(file, content);

    return file;
  }

  test("flags a CI-pinned scanner the pre-push gate never version-checks", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-prepush-scan-"));

    try {
      const digest = "@sha256:" + "a".repeat(64);
      const secrets = writeNamedWorkflow(
        root,
        "apps-api-security-secrets.yml",
        GITLEAKS_PIN_ENV
      );
      const sast = writeNamedWorkflow(
        root,
        SAST_WORKFLOW_NAME,
        `jobs:\n  sast:\n    container: semgrep/semgrep:1.142.0${digest}\n`
      );

      writePrePushSecurityScript(
        root,
        'EXPECTED_GITLEAKS_VERSION="$(grep -m1 GITLEAKS_VERSION: wf.yml)"\nLOCAL_GITLEAKS_VERSION="$(gitleaks version)"\n'
      );

      const violations = checkPrePushScannerParity(root, [secrets, sast]);

      expect(violations.map((row) => row.rule)).toContain(
        "security-scanner-version-parity"
      );
      expect(
        violations.some((row) =>
          row.message.includes("EXPECTED_SEMGREP_VERSION=")
        )
      ).toBe(true);
      expect(
        violations.some((row) =>
          row.message.includes("EXPECTED_GITLEAKS_VERSION=")
        )
      ).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("passes when the gate version-checks every CI-pinned scanner", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-prepush-scan-"));

    try {
      const digest = "@sha256:" + "b".repeat(64);
      const secrets = writeNamedWorkflow(
        root,
        "apps-api-security-secrets.yml",
        GITLEAKS_PIN_ENV
      );
      const sast = writeNamedWorkflow(
        root,
        SAST_WORKFLOW_NAME,
        `jobs:\n  sast:\n    container: semgrep/semgrep:1.142.0${digest}\n`
      );

      writePrePushSecurityScript(
        root,
        [
          'EXPECTED_GITLEAKS_VERSION="$(grep -m1 GITLEAKS_VERSION: wf.yml)"',
          'LOCAL_GITLEAKS_VERSION="$(gitleaks version)"',
          'EXPECTED_SEMGREP_VERSION="$(grep -m1 semgrep/semgrep: wf.yml)"',
          'LOCAL_SEMGREP_VERSION="$(semgrep --version)"',
          "",
        ].join("\n")
      );

      expect(checkPrePushScannerParity(root, [secrets, sast])).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("opts out when the repo has no pre-push security script", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-prepush-scan-"));

    try {
      const sast = writeNamedWorkflow(
        root,
        SAST_WORKFLOW_NAME,
        `jobs:\n  sast:\n    container: semgrep/semgrep:1.142.0@sha256:${"c".repeat(64)}\n`
      );

      expect(checkPrePushScannerParity(root, [sast])).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkWorkflowBunCache", () => {
  test("flags bun install without a cache step; passes cached and bun-free workflows", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-bun-cache-"));

    try {
      const uncached = join(root, "uncached.yml");

      writeFileSync(
        uncached,
        "jobs:\n  x:\n    steps:\n      - run: bun install\n"
      );

      expect(checkWorkflowBunCache(uncached).map((row) => row.rule)).toContain(
        "github-actions-bun-cache"
      );

      const cached = join(root, "cached.yml");

      writeFileSync(
        cached,
        "jobs:\n  x:\n    steps:\n      - uses: actions/cache@abc\n      - run: bun install\n"
      );

      expect(checkWorkflowBunCache(cached)).toEqual([]);

      const noBun = join(root, "nobun.yml");

      writeFileSync(noBun, "jobs: {}\n");

      expect(checkWorkflowBunCache(noBun)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkWorkflowServiceImageDigestPin", () => {
  test("flags a service image without a digest", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-svc-image-"));

    try {
      const file = join(root, "wf.yml");

      writeFileSync(
        file,
        "jobs:\n  test:\n    services:\n      postgres:\n        image: postgres:17-alpine\n"
      );

      const violations = checkWorkflowServiceImageDigestPin(file);

      expect(violations.map((row) => row.rule)).toContain(
        "github-actions-service-image-digest-pin"
      );
      expect(
        violations.some((row) =>
          row.message.includes("postgres:17-alpine (line 5)")
        )
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("flags latest mixed with a digest", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-svc-image-"));

    try {
      const file = join(root, "wf.yml");

      writeFileSync(
        file,
        "jobs:\n  test:\n    container:\n      image: tool/tool:latest@sha256:0000000000000000000000000000000000000000000000000000000000000000\n"
      );

      const violations = checkWorkflowServiceImageDigestPin(file);

      expect(violations.map((row) => row.rule)).toContain(
        "github-actions-service-image-digest-pin"
      );
      expect(
        violations.some((row) => row.message.includes("floating :latest tag"))
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("passes digest-pinned images and workflows without images", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-svc-image-"));

    try {
      const pinned = join(root, "pinned.yml");

      writeFileSync(
        pinned,
        "jobs:\n  test:\n    services:\n      postgres:\n        image: postgres:17-alpine@sha256:0000000000000000000000000000000000000000000000000000000000000000\n"
      );

      expect(checkWorkflowServiceImageDigestPin(pinned)).toEqual([]);

      const none = join(root, "none.yml");

      writeFileSync(none, "jobs: {}\n");

      expect(checkWorkflowServiceImageDigestPin(none)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkWorkflowExpressionSyntax", () => {
  test("flags the f-string triple-brace opener that bricks a workflow", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-expr-"));

    try {
      const file = join(root, "wf.yml");

      writeFileSync(
        file,
        "jobs:\n  x:\n    steps:\n      - run: |\n          python3 -c \"print(f'${{{pair[0]}:-...}}')\"\n"
      );

      const violations = checkWorkflowExpressionSyntax(file);

      expect(violations.map((row) => row.rule)).toContain(
        "github-actions-expression-syntax"
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("flags an opener with no closer on the line", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-expr-"));

    try {
      const file = join(root, "wf.yml");

      writeFileSync(file, "jobs:\n  x:\n    name: ${{ github.ref\n");

      const violations = checkWorkflowExpressionSyntax(file);

      expect(violations).toHaveLength(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("passes valid expressions, including quoted JSON arguments", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-expr-"));

    try {
      const file = join(root, "wf.yml");

      writeFileSync(
        file,
        [
          "concurrency:",
          "  group: x-${{ github.ref }}",
          "jobs:",
          "  x:",
          "    steps:",
          '      - run: echo ${{ fromJSON(steps.a.outputs.b || \'[{"version":""}]\')[0].version }}',
          "",
        ].join("\n")
      );

      expect(checkWorkflowExpressionSyntax(file)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

const CONTRACT_MD = "AGENT_CONTRACT.md";
const PKG_JSON = "package.json";

describe("schema-enum-field-consistency", () => {
  /*
   * The exact shape of the real regression: status/priority are literal-union enums on
   * input but t.String() on the response — the generated client widens them to `string`
   * and the UI enum can't reconcile.
   */
  const DRIFT = `import { t } from "elysia";
export const CreateTaskSchema = t.Object({
  status: t.Optional(
    t.Union([t.Literal("todo"), t.Literal("doing"), t.Literal("done")])
  ),
  priority: t.Optional(t.Union([t.Literal("low"), t.Literal("high")])),
});
export const TaskResponse = t.Object({
  id: t.String(),
  description: t.Optional(t.Union([t.String(), t.Null()])),
  status: t.String(),
  priority: t.String(),
});`;

  const CLEAN = `import { t } from "elysia";
const TaskStatus = t.Union([t.Literal("todo"), t.Literal("doing"), t.Literal("done")]);
export const CreateTaskSchema = t.Object({
  status: t.Optional(TaskStatus),
});
export const TaskResponse = t.Object({
  id: t.String(),
  description: t.Optional(t.Union([t.String(), t.Null()])),
  status: TaskStatus,
});`;

  test("flags every enum field widened to t.String() elsewhere in the file", () => {
    expect(inconsistentEnumFields(DRIFT)).toEqual(["priority", "status"]);
  });

  test("passes when the enum is defined once and reused (never t.String())", () => {
    expect(inconsistentEnumFields(CLEAN)).toEqual([]);
  });

  test("a nullable string (t.Union([t.String(), t.Null()])) is not treated as an enum", () => {
    expect(inconsistentEnumFields(DRIFT)).not.toContain("description");
  });

  test("checkSchemaEnumFieldConsistency reports drift only for src/*.schemas.ts", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-schema-enum-"));

    try {
      mkdirSync(join(root, "src", "api", "task"), { recursive: true });
      const schema = join(root, "src", "api", "task", "task.schemas.ts");

      writeFileSync(schema, DRIFT);

      const rules = checkSchemaEnumFieldConsistency(root, [schema]).map(
        (row) => row.rule
      );

      expect(rules).toEqual([
        "schema-enum-field-consistency",
        "schema-enum-field-consistency",
      ]);

      // A non-schema file with the same content is ignored (path filter).
      const other = join(root, "src", "api", "task", "task.ts");

      writeFileSync(other, DRIFT);
      expect(checkSchemaEnumFieldConsistency(root, [other])).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkAuditLogReadAccountScoped", () => {
  test("flags userId-only auditLog reads; passes account-scoped and write-path files", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-audit-scope-"));

    try {
      mkdirSync(join(root, "src"), { recursive: true });

      const bad = join(root, "src", "bad.service.ts");

      writeFileSync(
        bad,
        "const rows = await db\n  .select()\n  .from(auditLog)\n  .where(eq(auditLog.userId, userId));\n"
      );

      const violations = checkAuditLogReadAccountScoped(root, [bad]);

      expect(violations.map((row) => row.rule)).toEqual([
        "audit-log-read-account-scoped",
      ]);

      const good = join(root, "src", "good.service.ts");

      writeFileSync(
        good,
        "const rows = await db\n  .select()\n  .from(auditLog)\n  .where(\n    and(\n      eq(auditLog.userId, userId),\n      or(\n        eq(auditLog.targetAccountId, accountId),\n        isNull(auditLog.targetAccountId)\n      )\n    )\n  );\n"
      );

      expect(checkAuditLogReadAccountScoped(root, [good])).toEqual([]);

      const writer = join(root, "src", "writer.service.ts");

      writeFileSync(
        writer,
        "await db.insert(auditLog).values({ userId, action, resource });\n"
      );

      expect(checkAuditLogReadAccountScoped(root, [writer])).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("ignores test files and files outside src/", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-audit-scope-"));

    try {
      mkdirSync(join(root, "src"), { recursive: true });
      mkdirSync(join(root, "scripts"), { recursive: true });

      const testFile = join(root, "src", "feed.service.test.ts");
      const scriptFile = join(root, "scripts", "report.ts");
      const body = "where(eq(auditLog.userId, userId));\n";

      writeFileSync(testFile, body);
      writeFileSync(scriptFile, body);

      expect(
        checkAuditLogReadAccountScoped(root, [testFile, scriptFile])
      ).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkExternalClientTimeouts", () => {
  test("flags SDK constructors without timeout and bare fetch; passes bounded ones", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-timeouts-"));

    try {
      mkdirSync(join(root, "src"), { recursive: true });

      const bad = join(root, "src", "bad.ts");

      writeFileSync(
        bad,
        'const s = new Stripe(key);\nconst r = await fetch(url, { method: "POST" });\n'
      );

      const rules = checkExternalClientTimeouts([bad]).map((row) => row.rule);

      expect(rules).toHaveLength(2);

      const good = join(root, "src", "good.ts");

      writeFileSync(
        good,
        "const s = new Stripe(key, { timeout: 10_000 });\nconst r = await fetch(url, { signal: AbortSignal.timeout(10_000) });\n"
      );

      expect(checkExternalClientTimeouts([good])).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("flags an email transport module that is not bounded, passes a wrapped one", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-timeouts-"));

    try {
      mkdirSync(join(root, "src"), { recursive: true });

      const unbounded = join(root, "src", "resend.ts");

      writeFileSync(
        unbounded,
        "const client = new Resend(apiKey);\nawait client.emails.send(payload);\n"
      );

      const rules = checkExternalClientTimeouts([unbounded]).map(
        (row) => row.rule
      );

      expect(rules).toEqual(["external-client-timeout"]);

      const bounded = join(root, "src", "resend-ok.ts");

      writeFileSync(
        bounded,
        "const client = new Resend(apiKey);\nawait withEmailTimeout(() => client.emails.send(payload));\n"
      );

      expect(checkExternalClientTimeouts([bounded])).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkTofuBootstrapHardening", () => {
  function makeBootstrap(root: string, mainTf: string): void {
    const dir = join(root, "apps", "self");
    const bootstrapDir = join(root, "infra", "bootstrap");

    mkdirSync(dir, { recursive: true });
    mkdirSync(bootstrapDir, { recursive: true });
    writeFileSync(join(bootstrapDir, "main.tf"), mainTf);
  }

  test("flags missing lifecycle guard, open defaults, and curl|sh", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-tofu-"));

    try {
      makeBootstrap(
        root,
        [
          'resource "hcloud_server" "main" {',
          "  user_data = var.cloud_init",
          "}",
          'variable "ssh_allowed_ips" {',
          '  default = ["0.0.0.0/0"]',
          "}",
          '# - [bash, -c, "curl -fsSL https://get.docker.com | sh"]',
          "",
        ].join("\n")
      );

      const rules = checkTofuBootstrapHardening(join(root, "apps", "self")).map(
        (row) => row.rule
      );

      expect(rules).toContain("tofu-server-lifecycle-guard");
      expect(rules).toContain("tofu-no-open-admin-defaults");
      expect(rules).toContain("no-curl-pipe-sh");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("passes a guarded server with explicit inputs and verified installs", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-tofu-"));

    try {
      makeBootstrap(
        root,
        [
          'resource "hcloud_server" "main" {',
          "  user_data = var.cloud_init",
          "  lifecycle {",
          "    ignore_changes = [user_data]",
          "  }",
          "}",
          'variable "ssh_allowed_ips" {',
          "}",
          "",
        ].join("\n")
      );

      expect(checkTofuBootstrapHardening(join(root, "apps", "self"))).toEqual(
        []
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("flags a required_providers entry without a version, passes a pinned one", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-tofu-"));

    try {
      makeBootstrap(
        root,
        [
          "terraform {",
          "  required_providers {",
          '    hcloud = { source = "hetznercloud/hcloud" }',
          "  }",
          "}",
          "",
        ].join("\n")
      );

      expect(
        checkTofuBootstrapHardening(join(root, "apps", "self")).map(
          (row) => row.rule
        )
      ).toContain("tofu-provider-version-pin");

      makeBootstrap(
        root,
        [
          "terraform {",
          "  required_providers {",
          '    hcloud = { source = "hetznercloud/hcloud", version = "~> 1.48" }',
          "  }",
          "}",
          "",
        ].join("\n")
      );

      expect(checkTofuBootstrapHardening(join(root, "apps", "self"))).toEqual(
        []
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkEslintPluginContractParity", () => {
  test("flags installed-but-undocumented and documented-but-missing plugins", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-contract-"));

    try {
      writeFileSync(
        join(root, PKG_JSON),
        JSON.stringify({
          devDependencies: {
            "@boring-stack-pkg/eslint-plugin-code-flow": "0.2.0",
            "@boring-stack-pkg/eslint-plugin-comment-hygiene": "0.2.0",
          },
        })
      );
      writeFileSync(
        join(root, CONTRACT_MD),
        "| `code-flow` | early returns |\n| `@boring-stack-pkg/eslint-plugin-ghost-plugin` | not installed |\n"
      );

      const messages = checkEslintPluginContractParity(root).map(
        (row) => row.message
      );

      expect(
        messages.some((message) => message.includes("comment-hygiene"))
      ).toBe(true);
      expect(messages.some((message) => message.includes("ghost-plugin"))).toBe(
        true
      );
      expect(messages.some((message) => message.includes("code-flow"))).toBe(
        false
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("passes when contract and package.json agree", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-contract-"));

    try {
      writeFileSync(
        join(root, PKG_JSON),
        JSON.stringify({
          devDependencies: {
            "@boring-stack-pkg/eslint-plugin-code-flow": "0.2.0",
          },
        })
      );
      writeFileSync(
        join(root, CONTRACT_MD),
        "| `@boring-stack-pkg/eslint-plugin-code-flow` | early returns |\n"
      );

      expect(checkEslintPluginContractParity(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkTsconfigIncludePathsExist", () => {
  test("flags a literal include entry that does not exist, skips globs and hidden dirs", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-tsconfig-"));

    try {
      const appRoot = join(root, "apps", "self");
      const sibling = join(root, "apps", "docs");

      mkdirSync(appRoot, { recursive: true });
      mkdirSync(sibling, { recursive: true });
      writeFileSync(
        join(appRoot, "tsconfig.json"),
        JSON.stringify({ include: ["**/*"] })
      );
      writeFileSync(
        join(sibling, "tsconfig.json"),
        JSON.stringify({
          include: ["**/*", ".astro/types.d.ts", "./missing.d.ts"],
        })
      );

      const violations = checkTsconfigIncludePathsExist(appRoot);

      expect(violations).toHaveLength(1);
      expect(violations[0]?.message).toContain("./missing.d.ts");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("passes when every literal entry exists", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-tsconfig-"));

    try {
      const appRoot = join(root, "apps", "self");

      mkdirSync(appRoot, { recursive: true });
      writeFileSync(join(appRoot, "real.d.ts"), "export {};\n");
      writeFileSync(
        join(appRoot, "tsconfig.json"),
        JSON.stringify({ include: ["real.d.ts", "**/*"] })
      );

      expect(checkTsconfigIncludePathsExist(appRoot)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkEnginePinParity", () => {
  function writeEnginePinFixture(
    root: string,
    options: {
      engines?: { bun?: string };
      dockerBun: string;
      workflowBun: string;
    }
  ): void {
    writeFileSync(
      join(root, PKG_JSON),
      JSON.stringify({ engines: options.engines })
    );
    writeFileSync(
      join(root, "Dockerfile"),
      `FROM oven/bun:${options.dockerBun}-alpine@sha256:0000000000000000000000000000000000000000000000000000000000000000\n`
    );
    mkdirSync(join(root, ".github", "workflows"), { recursive: true });
    writeFileSync(
      join(root, ".github", "workflows", "ci.yml"),
      `jobs:\n  test:\n    steps:\n      - uses: oven-sh/setup-bun@abc\n        with:\n          bun-version: ${options.workflowBun}\n`
    );
  }

  test("flags a missing engines.bun pin", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-engine-"));

    try {
      writeEnginePinFixture(root, {
        dockerBun: "1.3.14",
        workflowBun: "1.3.14",
      });

      const violations = checkEnginePinParity(root);

      expect(
        violations.some((row) => row.message.includes("engines.bun"))
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("flags a monorepo root package.json without a matching engines.bun pin", () => {
    const monorepo = mkdtempSync(join(tmpdir(), "lint-meta-engine-mono-"));

    try {
      writeFileSync(join(monorepo, PKG_JSON), JSON.stringify({}));

      const appRoot = join(monorepo, "apps", "api");

      mkdirSync(appRoot, { recursive: true });
      writeEnginePinFixture(appRoot, {
        engines: { bun: "1.3.14" },
        dockerBun: "1.3.14",
        workflowBun: "1.3.14",
      });

      const violations = checkEnginePinParity(appRoot);

      expect(
        violations.some((row) =>
          row.message.includes("Monorepo root package.json")
        )
      ).toBe(true);

      writeFileSync(
        join(monorepo, PKG_JSON),
        JSON.stringify({ engines: { bun: "1.3.14" } })
      );

      expect(checkEnginePinParity(appRoot)).toEqual([]);
    } finally {
      rmSync(monorepo, { recursive: true, force: true });
    }
  });

  test("flags a Dockerfile bun tag that drifts from engines.bun", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-engine-"));

    try {
      writeEnginePinFixture(root, {
        engines: { bun: "1.3.14" },
        dockerBun: "1.2.0",
        workflowBun: "1.3.14",
      });

      const violations = checkEnginePinParity(root);

      expect(
        violations.some((row) =>
          row.message.includes("Dockerfile must pin oven/bun:1.3.14")
        )
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("flags a CI workflow bun-version that drifts from engines.bun", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-engine-"));

    try {
      writeEnginePinFixture(root, {
        engines: { bun: "1.3.14" },
        dockerBun: "1.3.14",
        workflowBun: "1.2.0",
      });

      const violations = checkEnginePinParity(root, [
        join(root, ".github", "workflows", "ci.yml"),
      ]);

      expect(
        violations.some((row) => row.message.includes("bun-version: 1.2.0"))
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("passes when package.json, Dockerfile, and CI agree", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-engine-"));

    try {
      writeEnginePinFixture(root, {
        engines: { bun: "1.3.14" },
        dockerBun: "1.3.14",
        workflowBun: "1.3.14",
      });

      const violations = checkEnginePinParity(root, [
        join(root, ".github", "workflows", "ci.yml"),
      ]);

      expect(violations).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("flags a drifted bun-version in any of several root workflows", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-engine-multi-"));

    try {
      writeFileSync(
        join(root, PKG_JSON),
        JSON.stringify({ engines: { bun: "1.3.14" } })
      );
      writeFileSync(
        join(root, "Dockerfile"),
        "FROM oven/bun:1.3.14-alpine@sha256:0000000000000000000000000000000000000000000000000000000000000000\n"
      );
      mkdirSync(join(root, ".github", "workflows"), { recursive: true });

      const good = join(root, ".github", "workflows", "apps-ui-validate.yml");
      const drifted = join(root, ".github", "workflows", "apps-api-ci.yml");

      writeFileSync(
        good,
        "jobs:\n  a:\n    steps:\n      - uses: oven-sh/setup-bun@abc\n        with:\n          bun-version: 1.3.14\n"
      );
      writeFileSync(
        drifted,
        "jobs:\n  b:\n    steps:\n      - uses: oven-sh/setup-bun@abc\n        with:\n          bun-version: 1.2.0\n"
      );

      const violations = checkEnginePinParity(root, [good, drifted]);

      expect(violations).toHaveLength(1);
      expect(violations[0]?.file).toBe(drifted);
      expect(violations[0]?.message).toContain("bun-version: 1.2.0");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkEnvSchemaDrift", () => {
  test("aligned schema and .env.example produces no violations", () => {
    const violations = checkEnvSchemaDrift(join(FIXTURES, "env-cascade-clean"));

    expect(violations).toEqual([]);
  });

  test("flags keys in .env.example missing from schema", () => {
    const violations = checkEnvSchemaDrift(join(FIXTURES, "env-cascade-extra"));

    expect(violations.length).toBe(1);
    expect(violations[0]?.rule).toBe("env-cascade-drift");
    expect(violations[0]?.message).toContain("STALE_VAR");
  });

  test("flags required schema keys missing from .env.example", () => {
    const violations = checkEnvSchemaDrift(
      join(FIXTURES, "env-cascade-missing")
    );

    expect(violations.length).toBe(1);
    expect(violations[0]?.rule).toBe("env-cascade-drift");
    expect(violations[0]?.message).toContain("DATABASE_URL");
  });
});

describe("collectSourceFiles", () => {
  test("skips tests/lint-meta subtree by default", () => {
    const testsRoot = join(FIXTURES, "../..");
    const files = collectSourceFiles(testsRoot);

    expect(files.some((file) => file.includes("lint-meta/"))).toBe(false);
  });

  test("includes scripts/lint-meta when walking scripts/", () => {
    const repoRoot = join(FIXTURES, "../../..");
    const files = collectSourceFiles(join(repoRoot, "scripts"), []);

    expect(
      files.some((file) =>
        file.replace(/\\/g, "/").includes("/scripts/lint-meta/")
      )
    ).toBe(true);
  });
});

describe("checkRouteFilesHaveTests", () => {
  test("flags a routes file without a matching test sibling", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-routes-"));

    try {
      mkdirSync(join(root, "src", "api", "tickets"), { recursive: true });
      writeFileSync(
        join(root, "src", "api", "tickets", "tickets.routes.ts"),
        "export const ticketsRoutes = {};\n"
      );

      const violations = checkRouteFilesHaveTests(root);

      expect(violations.length).toBe(1);
      expect(violations[0]?.rule).toBe("routes-require-test-sibling");
      expect(violations[0]?.message).toContain("tickets.routes.test.ts");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("passes when every routes file has a matching test sibling", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-routes-"));

    try {
      mkdirSync(join(root, "src", "api", "tickets"), { recursive: true });
      mkdirSync(join(root, "tests", "api", "tickets"), { recursive: true });

      writeFileSync(
        join(root, "src", "api", "tickets", "tickets.routes.ts"),
        "export const ticketsRoutes = {};\n"
      );
      writeFileSync(
        join(root, "tests", "api", "tickets", "tickets.routes.test.ts"),
        "import { test } from 'bun:test';\ntest('placeholder', () => {});\n"
      );

      const violations = checkRouteFilesHaveTests(root);

      expect(violations).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkLogicFilesHaveTests", () => {
  test.each(["service", "utils", "jobs", "check"])(
    "flags a *.%s.ts file without a matching test sibling",
    (suffix) => {
      const root = mkdtempSync(join(tmpdir(), "lint-meta-logic-"));

      try {
        mkdirSync(join(root, "src", "feature"), { recursive: true });
        writeFileSync(
          join(root, "src", "feature", `feature.${suffix}.ts`),
          "export const x = 1;\n"
        );

        const violations = checkLogicFilesHaveTests(root);

        expect(violations.length).toBe(1);
        expect(violations[0]?.rule).toBe("logic-files-require-test-sibling");
        expect(violations[0]?.message).toContain(`feature.${suffix}.test.ts`);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  );

  test("does not flag *.types.ts, *.schemas.ts, *.constants.ts or *.routes.ts (those are not logic suffixes)", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-logic-"));

    try {
      mkdirSync(join(root, "src", "feature"), { recursive: true });
      writeFileSync(
        join(root, "src", "feature", "feature.types.ts"),
        "export interface X {}\n"
      );
      writeFileSync(
        join(root, "src", "feature", "feature.schemas.ts"),
        "export const X = {};\n"
      );
      writeFileSync(
        join(root, "src", "feature", "feature.constants.ts"),
        "export const X = 1;\n"
      );
      writeFileSync(
        join(root, "src", "feature", "feature.routes.ts"),
        "export const x = 1;\n"
      );

      expect(checkLogicFilesHaveTests(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("passes when every logic file has a matching test sibling", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-logic-"));

    try {
      mkdirSync(join(root, "src", "feature"), { recursive: true });
      mkdirSync(join(root, "tests", "feature"), { recursive: true });

      writeFileSync(
        join(root, "src", "feature", "feature.service.ts"),
        "export const x = 1;\n"
      );
      writeFileSync(
        join(root, "tests", "feature", "feature.service.test.ts"),
        "import { test } from 'bun:test';\ntest('p', () => {});\n"
      );

      expect(checkLogicFilesHaveTests(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkTouchedTests", () => {
  const GIT_ADD = "git add -A";

  function initGitRepo(repo: string): void {
    execSync("git init -q -b main", { cwd: repo });
    execSync('git config user.email "test@example.com"', { cwd: repo });
    execSync('git config user.name "Test"', { cwd: repo });
    execSync("git config commit.gpgsign false", { cwd: repo });
  }

  test("invalid base ref → silent skip (no violations)", () => {
    const violations = checkTouchedTests(
      "definitely-not-a-real-ref-xyz",
      join(FIXTURES, "../..")
    );

    expect(violations).toEqual([]);
  });

  test("flags a service file modified without a matching test in the diff", () => {
    const repo = mkdtempSync(join(tmpdir(), "lint-meta-touched-"));

    try {
      initGitRepo(repo);

      mkdirSync(join(repo, "src", "api"), { recursive: true });
      mkdirSync(join(repo, "tests", "api"), { recursive: true });

      writeFileSync(
        join(repo, "src", "api", "tickets.service.ts"),
        "export const ticketsService = {};\n"
      );
      writeFileSync(
        join(repo, "tests", "api", "tickets.service.test.ts"),
        "import { describe } from 'bun:test';\ndescribe('placeholder', () => {});\n"
      );
      execSync(GIT_ADD, { cwd: repo });
      execSync('git commit -q -m "init"', { cwd: repo });

      writeFileSync(
        join(repo, "src", "api", "tickets.service.ts"),
        "export const ticketsService = { add: () => 1 };\n"
      );
      execSync(GIT_ADD, { cwd: repo });
      execSync('git commit -q -m "modify service without touching test"', {
        cwd: repo,
      });

      const violations = checkTouchedTests("HEAD~1", repo);

      expect(violations.length).toBe(1);
      expect(violations[0]?.rule).toBe("touch-tests-too");
      expect(violations[0]?.message).toContain("tickets.service");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("passes when both service and test were touched", () => {
    const repo = mkdtempSync(join(tmpdir(), "lint-meta-touched-"));

    try {
      initGitRepo(repo);

      mkdirSync(join(repo, "src", "api"), { recursive: true });
      mkdirSync(join(repo, "tests", "api"), { recursive: true });

      writeFileSync(
        join(repo, "src", "api", "tickets.service.ts"),
        "export const ticketsService = {};\n"
      );
      writeFileSync(
        join(repo, "tests", "api", "tickets.service.test.ts"),
        "import { describe } from 'bun:test';\ndescribe('init', () => {});\n"
      );
      execSync(GIT_ADD, { cwd: repo });
      execSync('git commit -q -m "init"', { cwd: repo });

      writeFileSync(
        join(repo, "src", "api", "tickets.service.ts"),
        "export const ticketsService = { add: () => 1 };\n"
      );
      writeFileSync(
        join(repo, "tests", "api", "tickets.service.test.ts"),
        "import { describe, expect, test } from 'bun:test';\ntest('add', () => { expect(1).toBe(1); });\n"
      );
      execSync(GIT_ADD, { cwd: repo });
      execSync('git commit -q -m "service + test together"', { cwd: repo });

      const violations = checkTouchedTests("HEAD~1", repo);

      expect(violations).toEqual([]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("flags a .check.ts modified without its test (parity with logic-files suffixes)", () => {
    const repo = mkdtempSync(join(tmpdir(), "lint-meta-touched-"));

    try {
      initGitRepo(repo);

      mkdirSync(join(repo, "src", "checks"), { recursive: true });
      mkdirSync(join(repo, "tests", "checks"), { recursive: true });

      writeFileSync(
        join(repo, "src", "checks", "database.check.ts"),
        "export const databaseCheck = () => true;\n"
      );
      writeFileSync(
        join(repo, "tests", "checks", "database.check.test.ts"),
        "import { describe } from 'bun:test';\ndescribe('placeholder', () => {});\n"
      );
      execSync(GIT_ADD, { cwd: repo });
      execSync('git commit -q -m "init"', { cwd: repo });

      writeFileSync(
        join(repo, "src", "checks", "database.check.ts"),
        "export const databaseCheck = () => false;\n"
      );
      execSync(GIT_ADD, { cwd: repo });
      execSync('git commit -q -m "modify check without touching test"', {
        cwd: repo,
      });

      const violations = checkTouchedTests("HEAD~1", repo);

      expect(violations.length).toBe(1);
      expect(violations[0]?.rule).toBe("touch-tests-too");
      expect(violations[0]?.message).toContain("database.check");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});

describe("checkNoDirectProcessEnv", () => {
  const TMPDIR_PREFIX = "lint-meta-env-";

  test("flags `process.env.X` access outside the env validator", () => {
    const root = mkdtempSync(join(tmpdir(), TMPDIR_PREFIX));

    try {
      mkdirSync(join(root, "src", "api", "billing"), { recursive: true });
      const file = join(root, "src", "api", "billing", "billing.service.ts");

      writeFileSync(
        file,
        "export const key = process.env.STRIPE_SECRET_KEY ?? '';\n"
      );

      const violations = checkNoDirectProcessEnv(root, [file]);

      expect(
        violations.some((row) => row.rule === "env-no-direct-process-env")
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("allows the env validator itself to read process.env", () => {
    const root = mkdtempSync(join(tmpdir(), TMPDIR_PREFIX));

    try {
      mkdirSync(join(root, "src", "config", "env"), { recursive: true });
      const file = join(root, "src", "config", "env", "validate.ts");

      writeFileSync(
        file,
        "export const validateEnv = (source = process.env) => source;\n"
      );

      expect(checkNoDirectProcessEnv(root, [file])).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("allows the email-preview CLI to read PREVIEW_PORT", () => {
    const root = mkdtempSync(join(tmpdir(), TMPDIR_PREFIX));

    try {
      mkdirSync(join(root, "src", "templates", "email"), { recursive: true });
      const file = join(root, "src", "templates", "email", "preview.ts");

      writeFileSync(file, "const port = process.env.PREVIEW_PORT;\n");

      expect(checkNoDirectProcessEnv(root, [file])).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("ignores references inside comments", () => {
    const root = mkdtempSync(join(tmpdir(), TMPDIR_PREFIX));

    try {
      mkdirSync(join(root, "src", "utils"), { recursive: true });
      const file = join(root, "src", "utils", "doc.ts");

      writeFileSync(
        file,
        "// Documentation that mentions process.env.PORT inline.\nexport const x = 1;\n"
      );

      expect(checkNoDirectProcessEnv(root, [file])).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("ignores files outside src/ (tests, scripts)", () => {
    const root = mkdtempSync(join(tmpdir(), TMPDIR_PREFIX));

    try {
      mkdirSync(join(root, "tests"), { recursive: true });
      const file = join(root, "tests", "setup.ts");

      writeFileSync(file, "process.env.DATABASE_URL = 'postgres://...';\n");

      expect(checkNoDirectProcessEnv(root, [file])).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("lint-meta guardrails", () => {
  test("checkNoRawRoleLiterals flags raw role strings in src", () => {
    const root = mkdtempSync(join(tmpdir(), GUARD_TMP_PREFIX));

    try {
      mkdirSync(join(root, "src", "api"), { recursive: true });
      const file = join(root, "src", "api", "bad.ts");

      writeFileSync(file, 'const x = me.role === "owner";\n');

      const violations = checkNoRawRoleLiterals(root, [file]);

      expect(violations.some((row) => row.rule === "no-raw-role-literal")).toBe(
        true
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("checkGeneratedArtifactContracts flags missing banner text", () => {
    const root = mkdtempSync(join(tmpdir(), GUARD_TMP_PREFIX));

    try {
      const artifactDir = join(root, "..", "ui", "src", "lib", "acl");

      mkdirSync(artifactDir, { recursive: true });
      writeFileSync(join(artifactDir, "acl.types.generated.ts"), "// stale\n");

      const violations = checkGeneratedArtifactContracts(root);

      expect(
        violations.some((row) => row.rule === "generated-artifact-contract")
      ).toBe(true);
    } finally {
      rmSync(join(root, "..", "ui"), { recursive: true, force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("checkPrePushParity flags CI workflow missing a manifest command", () => {
    const root = mkdtempSync(join(tmpdir(), GUARD_TMP_PREFIX));

    try {
      mkdirSync(join(root, "scripts", "ci"), { recursive: true });
      mkdirSync(join(root, ".github", "workflows"), { recursive: true });
      writeFileSync(
        join(root, "scripts", "ci", "pre-push.manifest.json"),
        JSON.stringify({
          ciWorkflow: ".github/workflows/ci.yml",
          requiredCommands: ["bun run check", "bun run missing-gate"],
        })
      );
      writeFileSync(
        join(root, ".github", "workflows", "ci.yml"),
        "jobs:\n  test:\n    steps:\n      - run: bun run check\n"
      );

      const violations = checkPrePushParity(root);

      expect(violations.some((row) => row.rule === "pre-push-ci-parity")).toBe(
        true
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("checkPrePushParity flags a malformed manifest instead of skipping", () => {
    const root = mkdtempSync(join(tmpdir(), GUARD_TMP_PREFIX));

    try {
      mkdirSync(join(root, "scripts", "ci"), { recursive: true });
      writeFileSync(
        join(root, "scripts", "ci", "pre-push.manifest.json"),
        JSON.stringify({ stages: ["bun run check"] })
      );

      const violations = checkPrePushParity(root);

      expect(violations.some((row) => row.message.includes("malformed"))).toBe(
        true
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("checkPrePushParity flags an unresolvable ciWorkflow instead of skipping", () => {
    const root = mkdtempSync(join(tmpdir(), GUARD_TMP_PREFIX));

    try {
      mkdirSync(join(root, "scripts", "ci"), { recursive: true });
      writeFileSync(
        join(root, "scripts", "ci", "pre-push.manifest.json"),
        JSON.stringify({
          ciWorkflow: ".github/workflows/does-not-exist-anywhere.yml",
          requiredCommands: ["bun run check"],
        })
      );

      const violations = checkPrePushParity(root);

      expect(
        violations.some((row) =>
          row.message.includes("not found from the app root upward")
        )
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("checkPrePushParity resolves the ciWorkflow at the monorepo root via walk-up", () => {
    const root = mkdtempSync(join(tmpdir(), GUARD_TMP_PREFIX));

    try {
      const appRoot = join(root, "apps", "api");

      mkdirSync(join(appRoot, "scripts", "ci"), { recursive: true });
      mkdirSync(join(root, ".github", "workflows"), { recursive: true });
      writeFileSync(
        join(appRoot, "scripts", "ci", "pre-push.manifest.json"),
        JSON.stringify({
          ciWorkflow: ".github/workflows/ci.yml",
          requiredCommands: ["bun run check", "bun run missing-gate"],
        })
      );
      writeFileSync(
        join(root, ".github", "workflows", "ci.yml"),
        "jobs:\n  test:\n    steps:\n      - run: bun run check\n"
      );

      const violations = checkPrePushParity(appRoot);

      expect(
        violations.some((row) => row.message.includes("bun run missing-gate"))
      ).toBe(true);
      expect(violations).toHaveLength(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkSkippedTestsHaveTracking", () => {
  test("flags a skipped test with no tracking comment", () => {
    const root = mkdtempSync(join(tmpdir(), GUARD_TMP_PREFIX));

    try {
      mkdirSync(join(root, "tests"), { recursive: true });
      writeFileSync(
        join(root, "tests", "sample.test.ts"),
        'import { it } from "bun:test";\nit.skip("later", () => {});\n'
      );

      const violations = checkSkippedTestsHaveTracking(root);

      expect(violations.length).toBe(1);
      expect(violations[0]?.rule).toBe("skipped-tests-need-tracking");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("passes when the skip carries a TODO(@owner) tracking comment", () => {
    const root = mkdtempSync(join(tmpdir(), GUARD_TMP_PREFIX));

    try {
      mkdirSync(join(root, "tests"), { recursive: true });
      writeFileSync(
        join(root, "tests", "sample.test.ts"),
        'import { it } from "bun:test";\n// TODO(@alice): unflake the clock\nit.skip("later", () => {});\n'
      );

      expect(checkSkippedTestsHaveTracking(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkDocsNoRetiredCredentials", () => {
  test("flags a retired credential in sibling docs prose", () => {
    const base = mkdtempSync(join(tmpdir(), GUARD_TMP_PREFIX));
    const root = join(base, "api");

    try {
      mkdirSync(join(base, "docs", "src", "content"), { recursive: true });
      writeFileSync(
        join(base, "docs", "src", "content", "setup.md"),
        "Log in with admin123456 or demo@example.com / password123.\n"
      );

      const violations = checkDocsNoRetiredCredentials(root);

      expect(violations.length).toBeGreaterThanOrEqual(2);
      expect(
        violations.every((v) => v.rule === "docs-no-retired-credentials")
      ).toBe(true);
      expect(violations.some((v) => v.message.includes("password123"))).toBe(
        true
      );
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  test("passes when docs prose references no retired credential", () => {
    const base = mkdtempSync(join(tmpdir(), GUARD_TMP_PREFIX));
    const root = join(base, "api");

    try {
      mkdirSync(join(base, "docs", "src", "content"), { recursive: true });
      writeFileSync(
        join(base, "docs", "src", "content", "setup.md"),
        "Sign up in dev; the verification email lands in Mailpit.\n"
      );

      expect(checkDocsNoRetiredCredentials(root)).toEqual([]);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});

describe("checkLintMetaRulesSelfCovered", () => {
  function scaffold(root: string, cliExports: string, testBody: string): void {
    mkdirSync(join(root, "scripts", "lint-meta", "rules", "source-text"), {
      recursive: true,
    });
    mkdirSync(join(root, "tests", "lint-meta"), { recursive: true });
    writeFileSync(
      join(root, "scripts", "lint-meta", "cli.ts"),
      `export {\n${cliExports}\n};\n`
    );
    writeFileSync(
      join(root, "tests", "lint-meta", "lint-meta.test.ts"),
      testBody
    );
    writeFileSync(
      join(root, "scripts", "lint-meta", "rules", "source-text", "demo.ts"),
      "export function checkDemo() {\n  return [];\n}\nexport const demoRule = { id: 'demo' };\n"
    );
  }

  test("flags a rule whose check fn is unexported and untested", () => {
    const root = mkdtempSync(join(tmpdir(), GUARD_TMP_PREFIX));

    try {
      scaffold(root, "  somethingElse,", "describe('checkSomethingElse');\n");

      const violations = checkLintMetaRulesSelfCovered(root);
      const messages = violations.map((row) => row.message).join("\n");

      expect(violations.every((row) => row.rule === RULE_SELF_COVERED)).toBe(
        true
      );
      expect(messages).toContain("not re-exported");
      expect(messages).toContain('describe("checkDemo"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("passes when the check fn is exported from cli.ts and has a test", () => {
    const root = mkdtempSync(join(tmpdir(), GUARD_TMP_PREFIX));

    try {
      scaffold(root, "  checkDemo,", 'describe("checkDemo", () => {});\n');

      expect(checkLintMetaRulesSelfCovered(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("RULES.md catalog", () => {
  test("matches generate-rules-md output", () => {
    const rulesPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../scripts/lint-meta/RULES.md"
    );

    expect(readFileSync(rulesPath, "utf8")).toBe(renderRulesMd());
  });
});
