import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "../../apps/api/node_modules/eslint";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

test("tooling lint rejects unsafe shortcuts and suppression while accepting typed code", async () => {
  /*
   * lintText must parse the supplied fixture, not the on-disk file cached by
   * typescript-eslint's CI single-run optimization.
   */
  const lint = new ESLint({
    cwd: join(ROOT, "tools"),
    overrideConfig: {
      languageOptions: {
        parserOptions: { disallowAutomaticSingleRunInference: true },
      },
    },
  });
  const filePath = join(ROOT, "tools/agent/inventory.ts");
  const [invalid] = await lint.lintText(
    "/* eslint-disable */\nexport function unsafe(value: any) { return value!.missing; }\n",
    { filePath }
  );
  const violations = invalid?.messages.map((message) => message.ruleId) ?? [];

  expect(violations).toContain("eslint-comments/no-use");
  expect(violations).toContain("@typescript-eslint/no-explicit-any");
  expect(violations).toContain("@typescript-eslint/no-non-null-assertion");

  const [valid] = await lint.lintText(
    "export function identity(value: string): string {\n  return value;\n}\n",
    { filePath }
  );

  expect(valid?.errorCount).toBe(0);
  expect(valid?.warningCount).toBe(0);
}, 30000);

/*
 * calculateConfigForFile is typed as `any`, so narrow it by hand rather than
 * asserting: an unreadable shape yields no resolvers and fails the test.
 */
function declaredResolvers(config: unknown): string[] {
  if (
    typeof config !== "object" ||
    config === null ||
    !("settings" in config)
  ) {
    return [];
  }

  const { settings } = config;

  if (
    typeof settings !== "object" ||
    settings === null ||
    !("import/resolver" in settings)
  ) {
    return [];
  }

  const resolver = settings["import/resolver"];

  if (typeof resolver !== "object" || resolver === null) {
    return [];
  }

  return Object.keys(resolver);
}

test("tooling lint pins its import resolver inside the repo", async () => {
  /*
   * tools/ has no node_modules. A resolver named only by string ("node") is
   * looked up from the linted file's directory, finds no dependency root, and
   * escapes to Bun's global install cache, whose version no lockfile here
   * pins. Every import rule then reports "Resolve error" instead of running.
   * Assert the declared resolver is an absolute path inside the repo, which
   * holds regardless of what the ambient cache happens to contain.
   */
  const lint = new ESLint({
    cwd: join(ROOT, "tools"),
    overrideConfig: {
      languageOptions: {
        parserOptions: { disallowAutomaticSingleRunInference: true },
      },
    },
  });
  const probePath = join(ROOT, "tools/agent/inventory.ts");
  const config: unknown = await lint.calculateConfigForFile(probePath);
  const resolvers = declaredResolvers(config);

  expect(resolvers.length).toBeGreaterThan(0);

  for (const resolver of resolvers) {
    expect(isAbsolute(resolver)).toBe(true);
    expect(resolver.startsWith(ROOT)).toBe(true);
    expect(existsSync(resolver)).toBe(true);
  }

  const [result] = await lint.lintText(
    'import { verify } from "./../agent/verification";\n\nexport const probe = verify;\n',
    { filePath: probePath }
  );
  const messages = result?.messages ?? [];

  expect(
    messages.some((message) => message.message.includes("Resolve error"))
  ).toBe(false);
  expect(messages.map((message) => message.ruleId)).toContain(
    "import/no-useless-path-segments"
  );
}, 30000);
