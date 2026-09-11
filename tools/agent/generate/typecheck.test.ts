import { expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { requireValue } from "../validation";
import { validateGeneratedTypes } from "./typecheck";

const GENERATED = "apps/api/src/generated/value.ts";

test("semantic validation resolves new modules and rejects incompatible edits before writes", () => {
  const root = mkdtempSync(join(tmpdir(), "bs-typecheck-"));

  try {
    mkdirSync(join(root, "apps/api/src"), { recursive: true });
    writeFileSync(
      join(root, "apps/api/tsconfig.json"),
      JSON.stringify({
        compilerOptions: { strict: true, noEmit: true, skipLibCheck: true },
        include: ["src/**/*.ts"],
      })
    );
    writeFileSync(
      join(root, "apps/api/src/index.ts"),
      'export const value: string = "original";'
    );
    const changes = [
      {
        path: "apps/api/src/index.ts",
        before: 'export const value: string = "original";',
        after:
          'import { value } from "./generated/value"; export const text: string = value;',
      },
      {
        path: GENERATED,
        before: null,
        after: 'export const value = "generated";',
      },
    ];

    expect(() => {
      validateGeneratedTypes(root, changes);
    }).not.toThrow();
    expect(() => {
      validateGeneratedTypes(root, [
        requireValue(changes[0], "Missing test edit"),
        { path: GENERATED, before: null, after: "export const value = 42;" },
      ]);
    }).toThrow("not assignable");
    expect(existsSync(join(root, GENERATED))).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
