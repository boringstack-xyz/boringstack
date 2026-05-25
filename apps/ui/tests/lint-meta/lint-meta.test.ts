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
  checkDependencyPairs,
  checkForbiddenText,
  checkNoCrossRepoImports,
  checkNoRawRoleLiterals,
  checkPackageJson,
  checkScriptRawFetch,
  checkUiEnvCascadeDrift,
  checkWorkflow,
  collectSourceFiles,
  findWorkflows,
  parseDotenvKeys
} from "../../scripts/lint-meta/cli";
import { renderRulesMd } from "../../scripts/lint-meta/generate-rules-md";

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

  test("checkNoCrossRepoImports flags sibling api-template imports", () => {
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

describe("RULES.md catalog", () => {
  test("matches generate-rules-md output", () => {
    const rulesPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../scripts/lint-meta/RULES.md"
    );

    expect(readFileSync(rulesPath, "utf8")).toBe(renderRulesMd());
  });
});
