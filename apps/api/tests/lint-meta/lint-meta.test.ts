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
  checkCanonicalHelpersSingleHome,
  checkDependencyPairs,
  checkDockerfileBaseImageShaPin,
  checkEnginePinParity,
  checkEnvSchemaDrift,
  checkEslintConfigNoWarn,
  checkEslintOverridePathsExist,
  checkEslintPluginContractParity,
  checkExactDependencyVersions,
  checkExternalClientTimeouts,
  checkForbiddenText,
  checkLogicFilesHaveTests,
  checkNoDirectProcessEnv,
  checkRouteFilesHaveTests,
  checkTouchedTests,
  checkTsconfigIncludePathsExist,
  checkWorkflowBunCache,
  checkWorkflowConcurrencyExplicit,
  checkWorkflowExpressionSyntax,
  checkWorkflowServiceImageDigestPin,
  checkWorkflowShas,
  checkWorkflowTimeouts,
  collectSourceFiles,
  findWorkflows,
  checkGeneratedArtifactContracts,
  checkNoRawRoleLiterals,
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
const RULE_SELF_COVERED = "lint-meta-rules-self-covered";

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

      const violations = checkEnginePinParity(root);

      expect(
        violations.some((row) => row.message.includes("bun-version: 1.3.14"))
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

      const violations = checkEnginePinParity(root);

      expect(violations).toEqual([]);
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
      execSync("git init -q -b main", { cwd: repo });
      execSync('git config user.email "test@example.com"', { cwd: repo });
      execSync('git config user.name "Test"', { cwd: repo });
      execSync("git config commit.gpgsign false", { cwd: repo });

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
      execSync("git add -A", { cwd: repo });
      execSync('git commit -q -m "init"', { cwd: repo });

      writeFileSync(
        join(repo, "src", "api", "tickets.service.ts"),
        "export const ticketsService = { add: () => 1 };\n"
      );
      execSync("git add -A", { cwd: repo });
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
      execSync("git init -q -b main", { cwd: repo });
      execSync('git config user.email "test@example.com"', { cwd: repo });
      execSync('git config user.name "Test"', { cwd: repo });
      execSync("git config commit.gpgsign false", { cwd: repo });

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
      execSync("git add -A", { cwd: repo });
      execSync('git commit -q -m "init"', { cwd: repo });

      writeFileSync(
        join(repo, "src", "api", "tickets.service.ts"),
        "export const ticketsService = { add: () => 1 };\n"
      );
      writeFileSync(
        join(repo, "tests", "api", "tickets.service.test.ts"),
        "import { describe, expect, test } from 'bun:test';\ntest('add', () => { expect(1).toBe(1); });\n"
      );
      execSync("git add -A", { cwd: repo });
      execSync('git commit -q -m "service + test together"', { cwd: repo });

      const violations = checkTouchedTests("HEAD~1", repo);

      expect(violations).toEqual([]);
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
        "Log in with admin123456 to get started.\n"
      );

      const violations = checkDocsNoRetiredCredentials(root);

      expect(violations.length).toBe(1);
      expect(violations[0]?.rule).toBe("docs-no-retired-credentials");
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
