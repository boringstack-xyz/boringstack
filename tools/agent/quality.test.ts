import { expect, test } from "bun:test";
import { join } from "node:path";
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
