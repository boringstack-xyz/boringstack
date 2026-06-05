import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import {
  checkCanonicalHelpersSingleHome,
  checkDependencyPairs,
  checkDockerfileBaseImageShaPin,
  checkDocsNoRetiredCredentials,
  checkEnginePinParity,
  checkEslintBanTypeAssertions,
  checkEslintConfigNoWarn,
  checkEslintPluginContractParity,
  checkForbiddenText,
  checkGeneratedArtifactContracts,
  checkI18nLocaleKeysUsed,
  checkLintMetaRulesSelfCovered,
  checkLogicFilesHaveTests,
  checkModulepreloadSizeLimitPatterns,
  checkNoCrossRepoImports,
  checkNoDirectImportMetaEnv,
  checkNoRawRoleLiterals,
  checkNoSilentErrorSwallow,
  checkPackageJson,
  checkPrePushParity,
  checkScriptRawFetch,
  checkSkippedTestsHaveTracking,
  checkTestFilesHaveSource,
  checkTofuBootstrapHardening,
  checkTsconfigIncludePathsExist,
  checkUiEnvCascadeDrift,
  checkWorkflow,
  checkWorkflowBunCache,
  checkWorkflowConcurrencyExplicit,
  checkWorkflowExpressionSyntax,
  checkWorkflowServiceImageDigestPin,
  checkWorkflowTimeouts,
  collectSourceFiles,
  findWorkflows,
  parseDotenvKeys
} from "../../scripts/lint-meta/cli";
import { renderRulesMd } from "../../scripts/lint-meta/generate-rules-md";
import { checkForbiddenText as checkForbiddenTextWithRoot } from "../../scripts/lint-meta/rules/source-text/forbidden-text";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("checkForbiddenText", () => {
  test("flags inline lint suppression directive", () => {
    const v = checkForbiddenText(
      join(FIXTURES, "source-text/inline-disable-comment.ts")
    );

    expect(v.map((row) => row.rule)).toContain("no-inline-lint-disable");
  });

  test("flags TS suppression directive", () => {
    const v = checkForbiddenText(
      join(FIXTURES, "source-text/ts-suppression.ts")
    );

    expect(v.map((row) => row.rule)).toContain("no-ts-ignore");
  });

  test("flags the raw-html escape hatch", () => {
    const v = checkForbiddenText(
      join(FIXTURES, "source-text/dangerous-html.tsx")
    );

    expect(v.map((row) => row.rule)).toContain("no-dangerous-html");
  });

  test("flags raw fetch outside the allowlisted transport", () => {
    const v = checkForbiddenText(join(FIXTURES, "source-text/raw-fetch.ts"));

    expect(v.map((row) => row.rule)).toContain("no-raw-fetch");
  });

  test("flags direct env access outside lib/env", () => {
    const v = checkForbiddenText(join(FIXTURES, "source-text/env-access.ts"));

    expect(v.map((row) => row.rule)).toContain("env-access");
  });

  test("flags the `dark:` Tailwind variant", () => {
    const v = checkForbiddenText(
      join(FIXTURES, "source-text/dark-variant.tsx")
    );

    expect(v.map((row) => row.rule)).toContain("no-dark-variant");
  });

  test("clean file produces no violations", () => {
    const v = checkForbiddenText(join(FIXTURES, "source-text/clean.ts"));

    expect(v).toEqual([]);
  });

  test("flags hardcoded ISO timestamps in shared factories and e2e only", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-iso-dates-"));

    try {
      const factoryDir = join(root, "tests", "factories");
      const srcDir = join(root, "src");

      mkdirSync(factoryDir, { recursive: true });
      mkdirSync(srcDir, { recursive: true });

      const factory = join(factoryDir, "bad.factory.ts");

      writeFileSync(factory, 'export const t = "2026-05-11T09:30:00.000Z";\n');

      expect(
        checkForbiddenTextWithRoot(factory, root).map((row) => row.rule)
      ).toContain("no-hardcoded-iso-dates-in-fixtures");

      const unitTest = join(srcDir, "thing.test.ts");

      writeFileSync(unitTest, 'export const t = "2026-05-11T09:30:00.000Z";\n');

      expect(
        checkForbiddenTextWithRoot(unitTest, root).map((row) => row.rule)
      ).not.toContain("no-hardcoded-iso-dates-in-fixtures");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("flags setTimeout sleeps in e2e files only", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-e2e-sleep-"));

    try {
      const e2eDir = join(root, "e2e");
      const srcDir = join(root, "src");

      mkdirSync(e2eDir, { recursive: true });
      mkdirSync(srcDir, { recursive: true });

      const sleepLine =
        "await new Promise((resolve) => setTimeout(resolve, 1000));\n";
      const spec = join(e2eDir, "thing.spec.ts");

      writeFileSync(spec, sleepLine);

      expect(
        checkForbiddenTextWithRoot(spec, root).map((row) => row.rule)
      ).toContain("no-sleep-in-e2e");

      const srcFile = join(srcDir, "thing.ts");

      writeFileSync(srcFile, sleepLine);

      expect(
        checkForbiddenTextWithRoot(srcFile, root).map((row) => row.rule)
      ).not.toContain("no-sleep-in-e2e");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkPackageJson", () => {
  test("flags caret/tilde versions in dependencies", () => {
    const v = checkPackageJson(join(FIXTURES, "package-caret-deps.json"));

    expect(v.length).toBeGreaterThan(0);
    expect(v[0]?.rule).toBe("package-json-exact-deps");
  });

  test("accepts exact deps + caret peerDeps", () => {
    const v = checkPackageJson(join(FIXTURES, "package-exact.json"));

    expect(v).toEqual([]);
  });
});

describe("checkDependencyPairs", () => {
  test("flags forbidden overlapping libs (axios + openapi-fetch)", () => {
    const v = checkDependencyPairs(join(FIXTURES, "package-overlap.json"));

    expect(v.length).toBeGreaterThan(0);
    expect(v[0]?.rule).toBe("no-overlapping-libs");
  });

  test("exact-deps fixture has no overlap", () => {
    const v = checkDependencyPairs(join(FIXTURES, "package-exact.json"));

    expect(v).toEqual([]);
  });
});

describe("checkWorkflow", () => {
  test("flags missing top-level permissions block", () => {
    const workflows = findWorkflows(join(FIXTURES, "workflows-no-permissions"));
    const v = workflows.flatMap(checkWorkflow);

    expect(v.some((row) => row.message.includes("permissions"))).toBe(true);
  });

  test("flags unpinned actions/checkout@v4", () => {
    const workflows = findWorkflows(join(FIXTURES, "workflows-bad"));
    const v = workflows.flatMap(checkWorkflow);

    expect(v.some((row) => row.message.includes("pin to a 40-char"))).toBe(
      true
    );
  });

  test("40-char SHA + permissions passes", () => {
    const workflows = findWorkflows(join(FIXTURES, "workflows-good"));
    const v = workflows.flatMap(checkWorkflow);

    expect(v).toEqual([]);
  });

  test("flags id-token: write with no OIDC consumer", () => {
    const workflows = findWorkflows(
      join(FIXTURES, "workflows-id-token-unused")
    );
    const v = workflows.flatMap(checkWorkflow);

    expect(v.some((row) => row.message.includes("id-token: write"))).toBe(true);
  });

  test("allows id-token: write when a cosign step consumes it", () => {
    const workflows = findWorkflows(join(FIXTURES, "workflows-id-token-used"));
    const v = workflows.flatMap(checkWorkflow);

    expect(v.some((row) => row.message.includes("id-token: write"))).toBe(
      false
    );
  });
});

describe("checkWorkflowTimeouts", () => {
  test("flags a job missing timeout-minutes, exempts reusable-workflow calls", () => {
    const workflows = findWorkflows(join(FIXTURES, "workflows-no-timeout"));
    const v = workflows.flatMap(checkWorkflowTimeouts);

    expect(v).toHaveLength(1);
    expect(v[0]?.rule).toBe("github-actions-timeout-required");
    expect(v[0]?.message).toContain('"test"');
  });

  test("job with timeout-minutes passes", () => {
    const workflows = findWorkflows(join(FIXTURES, "workflows-good"));
    const v = workflows.flatMap(checkWorkflowTimeouts);

    expect(v).toEqual([]);
  });
});

describe("collectSourceFiles", () => {
  test("skips tests/lint-meta subtree by default", () => {
    const repoRoot = join(FIXTURES, "../../..");
    const files = collectSourceFiles(join(repoRoot, "tests"));

    expect(
      files.some((file) =>
        file.replace(/\\/g, "/").includes("/tests/lint-meta/")
      )
    ).toBe(false);
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

describe("lint-meta guardrails", () => {
  test("checkNoRawRoleLiterals flags raw role strings in src", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-guard-"));

    try {
      mkdirSync(join(root, "src", "features"), { recursive: true });
      const file = join(root, "src", "features", "bad.ts");

      writeFileSync(file, 'const x = me.role === "owner";\n');

      const violations = checkNoRawRoleLiterals(root, [file]);

      expect(violations.some((row) => row.rule === "no-raw-role-literal")).toBe(
        true
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("checkUiEnvCascadeDrift flags vite-config-only keys missing from vite-env.d.ts", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-guard-"));

    try {
      mkdirSync(join(root, "src", "lib", "env"), { recursive: true });
      writeFileSync(join(root, ".env.example"), "VITE_API_PROXY_TARGET=\n");
      writeFileSync(
        join(root, "src", "lib", "env", "schema.ts"),
        "export {};\n"
      );
      writeFileSync(
        join(root, "src", "vite-env.d.ts"),
        "interface ImportMetaEnv { readonly VITE_API_URL: string; }\n"
      );

      const violations = checkUiEnvCascadeDrift(root);

      expect(violations.some((row) => row.rule === "env-cascade-drift")).toBe(
        true
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("checkScriptRawFetch flags fetch in scripts outside allowlist", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-guard-"));

    try {
      mkdirSync(join(root, "scripts"), { recursive: true });
      const file = join(root, "scripts", "bad-script.ts");

      writeFileSync(file, "await fetch('https://example.com');\n");

      const violations = checkScriptRawFetch(root, [file]);

      expect(violations.some((row) => row.rule === "no-raw-fetch")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("checkScriptRawFetch allows GitHub SHA verify fetch in github-actions-permissions", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
    const file = join(
      root,
      "scripts/lint-meta/rules/ci/github-actions-permissions.ts"
    );

    expect(checkScriptRawFetch(root, [file])).toEqual([]);
  });

  test("checkNoCrossRepoImports flags imports that escape apps/ui", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-guard-"));

    try {
      const file = join(
        root,
        "tests",
        "cross-template",
        "oauth-providers.test.ts"
      );

      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(
        file,
        `import { OAUTH_PROVIDERS } from "../../../api/src/lib/oauth/oauth.manifest";\n`
      );

      const violations = checkNoCrossRepoImports(root, [file]);

      expect(violations.map((row) => row.rule)).toEqual([
        "no-cross-repo-import"
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("checkNoCrossRepoImports flags imports that resolve outside repo root", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-guard-"));

    try {
      const file = join(root, "src", "lib", "escape.ts");

      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(
        file,
        `import { helper } from "../../../outside-repo/helper";\n`
      );

      const violations = checkNoCrossRepoImports(root, [file]);

      expect(violations.map((row) => row.rule)).toEqual([
        "no-cross-repo-import"
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("checkNoCrossRepoImports allows in-repo relative imports", () => {
    const violations = checkNoCrossRepoImports(
      join(dirname(fileURLToPath(import.meta.url)), "../.."),
      [join(FIXTURES, "source-text", "clean.ts")]
    );

    expect(violations).toEqual([]);
  });

  test("parseDotenvKeys ignores comments and blank lines", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-guard-"));

    try {
      const envFile = join(root, ".env.example");

      writeFileSync(envFile, "# comment\n\nVITE_FOO=bar\nnot-a-key=1\n");

      expect(parseDotenvKeys(envFile)).toEqual(new Set(["VITE_FOO"]));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkNoDirectImportMetaEnv", () => {
  test("flags `import.meta.env.X` access outside env.loader.ts", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-env-"));

    try {
      mkdirSync(join(root, "src", "features", "auth"), { recursive: true });
      const file = join(root, "src", "features", "auth", "Auth.hooks.ts");

      writeFileSync(
        file,
        "export const baseUrl = import.meta.env.VITE_API_URL;\n"
      );

      const violations = checkNoDirectImportMetaEnv(root, [file]);

      expect(
        violations.some((row) => row.rule === "env-no-direct-import-meta-env")
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("allows env.loader.ts to read import.meta.env", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-env-"));

    try {
      mkdirSync(join(root, "src", "lib", "env"), { recursive: true });
      const file = join(root, "src", "lib", "env", "env.loader.ts");

      writeFileSync(
        file,
        "export const loadEnv = () => envSchema.parse(import.meta.env);\n"
      );

      expect(checkNoDirectImportMetaEnv(root, [file])).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("ignores files outside src/ (tests, scripts)", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-env-"));

    try {
      mkdirSync(join(root, "tests"), { recursive: true });
      const file = join(root, "tests", "setup.ts");

      writeFileSync(file, "const mode = import.meta.env.MODE;\n");

      expect(checkNoDirectImportMetaEnv(root, [file])).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkNoSilentErrorSwallow", () => {
  test("flags catch { return null } in *.queries.ts", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-queries-"));

    try {
      mkdirSync(join(root, "src", "features", "auth"), { recursive: true });
      const file = join(root, "src", "features", "auth", "Auth.queries.ts");

      writeFileSync(
        file,
        [
          "export function useMe() {",
          "  return useQuery({",
          "    queryFn: async () => {",
          "      try {",
          "        return await apiClient.GET('/me');",
          "      } catch (error) {",
          "        return null;",
          "      }",
          "    }",
          "  });",
          "}",
          ""
        ].join("\n")
      );

      const violations = checkNoSilentErrorSwallow(root, [file]);

      expect(
        violations.some((row) => row.rule === "queries-no-silent-error-swallow")
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("respects // allow-silent: opt-out comment immediately above the catch", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-queries-"));

    try {
      mkdirSync(join(root, "src", "features", "search"), { recursive: true });
      const file = join(root, "src", "features", "search", "Search.queries.ts");

      writeFileSync(
        file,
        [
          "export function useSearch() {",
          "  return useQuery({",
          "    queryFn: async () => {",
          "      try {",
          "        return await apiClient.GET('/search');",
          "      // allow-silent: missing index is not a UX error",
          "      } catch (error) {",
          "        return null;",
          "      }",
          "    }",
          "  });",
          "}",
          ""
        ].join("\n")
      );

      expect(checkNoSilentErrorSwallow(root, [file])).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("ignores files outside src/features/", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-queries-"));

    try {
      mkdirSync(join(root, "src", "lib", "api"), { recursive: true });
      const file = join(root, "src", "lib", "api", "Api.queries.ts");

      writeFileSync(file, "try { return f(); } catch (e) { return null; }\n");

      expect(checkNoSilentErrorSwallow(root, [file])).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("ignores non-queries.ts files inside src/features/", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-queries-"));

    try {
      mkdirSync(join(root, "src", "features", "auth"), { recursive: true });
      const file = join(root, "src", "features", "auth", "Auth.utils.ts");

      writeFileSync(file, "try { return f(); } catch (e) { return null; }\n");

      expect(checkNoSilentErrorSwallow(root, [file])).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkCanonicalHelpersSingleHome", () => {
  test("returns no violations on a clean file when the registry is empty", () => {
    const violations = checkCanonicalHelpersSingleHome(
      join(FIXTURES, "source-text/clean.ts"),
      join(FIXTURES, "..", "..", "..")
    );

    expect(violations).toEqual([]);
  });
});

describe("checkTestFilesHaveSource", () => {
  test("flags a colocated test with no source sibling", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-orphan-"));

    try {
      mkdirSync(join(root, "src", "lib", "web-push"), { recursive: true });
      writeFileSync(
        join(root, "src", "lib", "web-push", "orphan.test.ts"),
        "import { it } from 'vitest';\nit('x', () => {});\n"
      );

      const violations = checkTestFilesHaveSource(root);

      expect(
        violations.some(
          (row) => row.rule === "test-files-require-source-sibling"
        )
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("passes when a .test.tsx mirrors a .tsx source", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-orphan-"));

    try {
      mkdirSync(join(root, "src", "components"), { recursive: true });
      writeFileSync(
        join(root, "src", "components", "Widget.tsx"),
        "export const Widget = () => null;\n"
      );
      writeFileSync(
        join(root, "src", "components", "Widget.test.tsx"),
        "import { it } from 'vitest';\nit('x', () => {});\n"
      );

      const violations = checkTestFilesHaveSource(root);

      expect(violations).toEqual([]);
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
          ""
        ].join("\n")
      );

      expect(checkWorkflowExpressionSyntax(file)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkI18nLocaleKeysUsed", () => {
  test("flags a defined-but-unused leaf key; honors literals and dynamic prefixes", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-i18n-used-"));

    try {
      const localeDir = join(root, "src", "lib", "i18n", "locales", "en");

      mkdirSync(localeDir, { recursive: true });
      writeFileSync(
        join(localeDir, "common.json"),
        JSON.stringify({
          billing: { currentPlan: { free: "Free", paid: "Paid" } },
          auth: { oauth: { google: "Google", github: "GitHub" } }
        })
      );

      const srcFile = join(root, "src", "page.tsx");

      writeFileSync(
        srcFile,
        't("billing.currentPlan.free");\nt(`auth.oauth.${provider}`);\n'
      );

      const violations = checkI18nLocaleKeysUsed(root, [srcFile]);

      expect(violations.map((row) => row.message)).toContainEqual(
        expect.stringContaining("billing.currentPlan.paid")
      );
      expect(violations).toHaveLength(1);
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
          ""
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
          ""
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
          ""
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
          ""
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
        join(root, "package.json"),
        JSON.stringify({
          devDependencies: {
            "@boring-stack-pkg/eslint-plugin-code-flow": "0.2.0",
            "@boring-stack-pkg/eslint-plugin-comment-hygiene": "0.2.0"
          }
        })
      );
      writeFileSync(
        join(root, "AGENT_CONTRACT.md"),
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
        join(root, "package.json"),
        JSON.stringify({
          devDependencies: {
            "@boring-stack-pkg/eslint-plugin-code-flow": "0.2.0"
          }
        })
      );
      writeFileSync(
        join(root, "AGENT_CONTRACT.md"),
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
          include: ["**/*", ".astro/types.d.ts", "./missing.d.ts"]
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
  function writeEnginePinFixture(root: string, bunWorkflowPin: string): string {
    const appRoot = join(root, "apps", "ui");

    mkdirSync(appRoot, { recursive: true });
    mkdirSync(join(root, ".github", "workflows"), { recursive: true });
    writeFileSync(join(appRoot, ".nvmrc"), "24\n");
    writeFileSync(
      join(appRoot, "package.json"),
      JSON.stringify({
        engines: { node: ">=24.0.0" },
        packageManager: "bun@1.3.14"
      })
    );
    writeFileSync(
      join(root, ".github", "workflows", "validate.yml"),
      `jobs:\n  validate:\n    steps:\n      - uses: oven-sh/setup-bun@abc\n        with:\n          bun-version: ${bunWorkflowPin}\n`
    );

    return appRoot;
  }

  test("flags a workflow bun-version pin that drifts from packageManager", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-engine-"));

    try {
      const appRoot = writeEnginePinFixture(root, "1.2.0");

      const violations = checkEnginePinParity(appRoot);

      expect(violations.map((row) => row.message)).toContainEqual(
        expect.stringContaining("bun-version: 1.2.0")
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("flags a monorepo root package.json without a matching engines.bun pin", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-engine-"));

    try {
      const appRoot = writeEnginePinFixture(root, "1.3.14");

      writeFileSync(join(root, "package.json"), JSON.stringify({}));

      expect(
        checkEnginePinParity(appRoot).map((row) => row.message)
      ).toContainEqual(expect.stringContaining("Monorepo root package.json"));

      writeFileSync(
        join(root, "package.json"),
        JSON.stringify({ engines: { bun: "1.3.14" } })
      );

      expect(
        checkEnginePinParity(appRoot).map((row) => row.message)
      ).not.toContainEqual(
        expect.stringContaining("Monorepo root package.json")
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("passes when the workflow bun-version matches packageManager", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-engine-"));

    try {
      const appRoot = writeEnginePinFixture(root, "1.3.14");

      const violations = checkEnginePinParity(appRoot);

      expect(violations).toEqual([]);
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

describe("checkWorkflowConcurrencyExplicit", () => {
  test("flags a concurrency block without cancel-in-progress", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-concurrency-"));

    try {
      const file = join(root, "wf.yml");

      writeFileSync(
        file,
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
      const explicit = join(root, "explicit.yml");

      writeFileSync(
        explicit,
        "concurrency:\n  group: x-${{ github.ref }}\n  cancel-in-progress: true\n\njobs: {}\n"
      );

      expect(checkWorkflowConcurrencyExplicit(explicit)).toEqual([]);

      const none = join(root, "none.yml");

      writeFileSync(none, "jobs: {}\n");

      expect(checkWorkflowConcurrencyExplicit(none)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
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

      expect(violations.map((row) => row.message)).toContainEqual(
        expect.stringContaining("oven/bun:1.3.14-alpine (line 1)")
      );
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
          "FROM nginx:1.31-alpine@sha256:0000000000000000000000000000000000000000000000000000000000000000 AS runner",
          ""
        ].join("\n")
      );

      const violations = checkDockerfileBaseImageShaPin(root);

      expect(violations).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkPrePushParity", () => {
  test("flags a malformed manifest instead of silently skipping", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-prepush-"));

    try {
      mkdirSync(join(root, "scripts", "ci"), { recursive: true });
      writeFileSync(
        join(root, "scripts", "ci", "pre-push.manifest.json"),
        JSON.stringify({ stages: ["bun run check"] })
      );

      const violations = checkPrePushParity(root);

      expect(violations.map((row) => row.message)).toContainEqual(
        expect.stringContaining("malformed")
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("flags an unresolvable ciWorkflow instead of silently skipping", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-prepush-"));

    try {
      mkdirSync(join(root, "scripts", "ci"), { recursive: true });
      writeFileSync(
        join(root, "scripts", "ci", "pre-push.manifest.json"),
        JSON.stringify({
          ciWorkflow: ".github/workflows/does-not-exist-anywhere.yml",
          requiredCommands: ["bun run check"]
        })
      );

      const violations = checkPrePushParity(root);

      expect(violations.map((row) => row.message)).toContainEqual(
        expect.stringContaining("not found from the app root upward")
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("resolves the ciWorkflow at the monorepo root via walk-up", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-prepush-"));

    try {
      const appRoot = join(root, "apps", "ui");

      mkdirSync(join(appRoot, "scripts", "ci"), { recursive: true });
      mkdirSync(join(root, ".github", "workflows"), { recursive: true });
      writeFileSync(
        join(appRoot, "scripts", "ci", "pre-push.manifest.json"),
        JSON.stringify({
          ciWorkflow: ".github/workflows/validate.yml",
          requiredCommands: ["bun run check", "bun run missing-gate"]
        })
      );
      writeFileSync(
        join(root, ".github", "workflows", "validate.yml"),
        "jobs:\n  validate:\n    steps:\n      - run: bun run check\n"
      );

      const violations = checkPrePushParity(appRoot);

      expect(violations.map((row) => row.message)).toContainEqual(
        expect.stringContaining("bun run missing-gate")
      );
      expect(violations).toHaveLength(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkEslintBanTypeAssertions", () => {
  const runOn = (body: string) => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-ban-as-"));

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

  test("the live ui eslint config is compliant (0 violations)", () => {
    const appRoot = join(FIXTURES, "..", "..", "..");

    expect(checkEslintBanTypeAssertions(appRoot)).toEqual([]);
  });
});

describe("checkEslintConfigNoWarn", () => {
  test("flags a warn severity in the eslint config", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-guard-"));

    try {
      writeFileSync(
        join(root, "eslint.config.mjs"),
        'export default [{ rules: { "no-x": "warn" } }];\n'
      );

      const violations = checkEslintConfigNoWarn(root);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0]?.rule).toBe("eslint-config-no-warn");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("passes when every severity is error or off", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-guard-"));

    try {
      writeFileSync(
        join(root, "eslint.config.mjs"),
        'export default [{ rules: { "no-x": "error", "no-y": "off" } }];\n'
      );

      expect(checkEslintConfigNoWarn(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkDocsNoRetiredCredentials", () => {
  test("flags a retired credential in sibling docs prose", () => {
    const base = mkdtempSync(join(tmpdir(), "lint-meta-guard-"));
    const root = join(base, "ui");

    try {
      mkdirSync(join(base, "docs", "src", "content"), { recursive: true });
      writeFileSync(
        join(base, "docs", "src", "content", "setup.md"),
        "Log in with admin123456 to start.\n"
      );

      const violations = checkDocsNoRetiredCredentials(root);

      expect(violations.length).toBe(1);
      expect(violations[0]?.rule).toBe("docs-no-retired-credentials");
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  test("passes when docs reference no retired credential", () => {
    const base = mkdtempSync(join(tmpdir(), "lint-meta-guard-"));
    const root = join(base, "ui");

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

describe("checkGeneratedArtifactContracts", () => {
  test("flags a generated artifact missing its banner text", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-guard-"));

    try {
      mkdirSync(join(root, "src", "lib", "acl"), { recursive: true });
      writeFileSync(
        join(root, "src", "lib", "acl", "acl.types.generated.ts"),
        "export type Role = string;\n"
      );

      const violations = checkGeneratedArtifactContracts(root);

      expect(violations.length).toBeGreaterThanOrEqual(1);
      expect(violations[0]?.rule).toBe("generated-artifact-contract");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("passes when every generated artifact carries its banner", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-guard-"));

    try {
      mkdirSync(join(root, "src", "lib", "acl"), { recursive: true });
      mkdirSync(join(root, "src", "lib", "api"), { recursive: true });
      writeFileSync(
        join(root, "src", "lib", "acl", "acl.types.generated.ts"),
        "// AUTO-GENERATED by generate:acl-types — do not edit.\nexport type Role = string;\n"
      );
      writeFileSync(
        join(root, "src", "lib", "api", "schema.d.ts"),
        "// DO NOT EDIT — regenerate via generate:api.\nexport type Schema = unknown;\n"
      );

      expect(checkGeneratedArtifactContracts(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkLogicFilesHaveTests", () => {
  test("flags a logic module under src/lib/guards without a test sibling", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-guard-"));

    try {
      mkdirSync(join(root, "src", "lib", "guards"), { recursive: true });
      writeFileSync(
        join(root, "src", "lib", "guards", "auth.ts"),
        "export const guard = () => true;\n"
      );

      const violations = checkLogicFilesHaveTests(root);

      expect(violations.length).toBe(1);
      expect(violations[0]?.rule).toBe("logic-files-require-test-sibling");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("passes when the logic module has a colocated test", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-guard-"));

    try {
      mkdirSync(join(root, "src", "lib", "guards"), { recursive: true });
      writeFileSync(
        join(root, "src", "lib", "guards", "auth.ts"),
        "export const guard = () => true;\n"
      );
      writeFileSync(
        join(root, "src", "lib", "guards", "auth.test.ts"),
        'import { test } from "vitest";\ntest("g", () => {});\n'
      );

      expect(checkLogicFilesHaveTests(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkModulepreloadSizeLimitPatterns", () => {
  test("flags a .size-limit.json missing required modulepreload globs", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-guard-"));

    try {
      writeFileSync(join(root, ".size-limit.json"), "[]\n");

      const violations = checkModulepreloadSizeLimitPatterns(root);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0]?.rule).toBe("modulepreload-size-limit-coverage");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("passes (no-ops) when there is no .size-limit.json", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-guard-"));

    try {
      expect(checkModulepreloadSizeLimitPatterns(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkSkippedTestsHaveTracking", () => {
  test("flags a skipped test with no tracking comment", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-guard-"));

    try {
      mkdirSync(join(root, "tests"), { recursive: true });
      writeFileSync(
        join(root, "tests", "sample.test.ts"),
        'import { it } from "vitest";\nit.skip("later", () => {});\n'
      );

      const violations = checkSkippedTestsHaveTracking(root);

      expect(violations.length).toBe(1);
      expect(violations[0]?.rule).toBe("skipped-tests-need-tracking");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("passes when the skip carries a TODO(@owner) comment", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-guard-"));

    try {
      mkdirSync(join(root, "tests"), { recursive: true });
      writeFileSync(
        join(root, "tests", "sample.test.ts"),
        'import { it } from "vitest";\n// TODO(@alice): unflake\nit.skip("later", () => {});\n'
      );

      expect(checkSkippedTestsHaveTracking(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkLintMetaRulesSelfCovered", () => {
  function scaffold(root: string, cliExports: string, testBody: string): void {
    mkdirSync(join(root, "scripts", "lint-meta", "rules", "source-text"), {
      recursive: true
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
    const root = mkdtempSync(join(tmpdir(), "lint-meta-guard-"));

    try {
      scaffold(root, "  somethingElse", "describe('checkSomethingElse');\n");

      const violations = checkLintMetaRulesSelfCovered(root);
      const messages = violations.map((row) => row.message).join("\n");

      expect(
        violations.every((row) => row.rule === "lint-meta-rules-self-covered")
      ).toBe(true);
      expect(messages).toContain("not re-exported");
      expect(messages).toContain('describe("checkDemo"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("passes when the check fn is exported and has a test", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-guard-"));

    try {
      scaffold(root, "  checkDemo", 'describe("checkDemo", () => {});\n');

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
