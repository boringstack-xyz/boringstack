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
  checkEnginePinParity,
  checkForbiddenText,
  checkNoCrossRepoImports,
  checkNoDirectImportMetaEnv,
  checkNoRawRoleLiterals,
  checkNoSilentErrorSwallow,
  checkPackageJson,
  checkPrePushParity,
  checkScriptRawFetch,
  checkTestFilesHaveSource,
  checkUiEnvCascadeDrift,
  checkWorkflow,
  checkWorkflowConcurrencyExplicit,
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

describe("RULES.md catalog", () => {
  test("matches generate-rules-md output", () => {
    const rulesPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../scripts/lint-meta/RULES.md"
    );

    expect(readFileSync(rulesPath, "utf8")).toBe(renderRulesMd());
  });
});
