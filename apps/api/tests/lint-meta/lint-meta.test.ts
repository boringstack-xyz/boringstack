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
  checkDependencyPairs,
  checkEnvSchemaDrift,
  checkEslintConfigNoWarn,
  checkExactDependencyVersions,
  checkForbiddenText,
  checkLogicFilesHaveTests,
  checkRouteFilesHaveTests,
  checkTouchedTests,
  checkWorkflowShas,
  collectSourceFiles,
  findWorkflows,
  checkGeneratedArtifactContracts,
  checkNoRawRoleLiterals,
  checkPrePushParity,
} from "../../scripts/lint-meta/cli";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

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
      mkdirSync(join(root, "src", "api", "widgets"), { recursive: true });
      writeFileSync(
        join(root, "src", "api", "widgets", "widgets.routes.ts"),
        "export const widgetsRoutes = {};\n"
      );

      const violations = checkRouteFilesHaveTests(root);

      expect(violations.length).toBe(1);
      expect(violations[0]?.rule).toBe("routes-require-test-sibling");
      expect(violations[0]?.message).toContain("widgets.routes.test.ts");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("passes when every routes file has a matching test sibling", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-routes-"));

    try {
      mkdirSync(join(root, "src", "api", "widgets"), { recursive: true });
      mkdirSync(join(root, "tests", "api", "widgets"), { recursive: true });

      writeFileSync(
        join(root, "src", "api", "widgets", "widgets.routes.ts"),
        "export const widgetsRoutes = {};\n"
      );
      writeFileSync(
        join(root, "tests", "api", "widgets", "widgets.routes.test.ts"),
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
        join(repo, "src", "api", "widgets.service.ts"),
        "export const widgetsService = {};\n"
      );
      writeFileSync(
        join(repo, "tests", "api", "widgets.service.test.ts"),
        "import { describe } from 'bun:test';\ndescribe('placeholder', () => {});\n"
      );
      execSync("git add -A", { cwd: repo });
      execSync('git commit -q -m "init"', { cwd: repo });

      writeFileSync(
        join(repo, "src", "api", "widgets.service.ts"),
        "export const widgetsService = { add: () => 1 };\n"
      );
      execSync("git add -A", { cwd: repo });
      execSync('git commit -q -m "modify service without touching test"', {
        cwd: repo,
      });

      const violations = checkTouchedTests("HEAD~1", repo);

      expect(violations.length).toBe(1);
      expect(violations[0]?.rule).toBe("touch-tests-too");
      expect(violations[0]?.message).toContain("widgets.service");
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
        join(repo, "src", "api", "widgets.service.ts"),
        "export const widgetsService = {};\n"
      );
      writeFileSync(
        join(repo, "tests", "api", "widgets.service.test.ts"),
        "import { describe } from 'bun:test';\ndescribe('init', () => {});\n"
      );
      execSync("git add -A", { cwd: repo });
      execSync('git commit -q -m "init"', { cwd: repo });

      writeFileSync(
        join(repo, "src", "api", "widgets.service.ts"),
        "export const widgetsService = { add: () => 1 };\n"
      );
      writeFileSync(
        join(repo, "tests", "api", "widgets.service.test.ts"),
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

describe("lint-meta guardrails", () => {
  test("checkNoRawRoleLiterals flags raw role strings in src", () => {
    const root = mkdtempSync(join(tmpdir(), "lint-meta-guard-"));

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
    const root = mkdtempSync(join(tmpdir(), "lint-meta-guard-"));

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
    const root = mkdtempSync(join(tmpdir(), "lint-meta-guard-"));

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
