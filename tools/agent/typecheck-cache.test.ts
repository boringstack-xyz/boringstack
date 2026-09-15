import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runProcess } from "./process";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

test("warm incremental typechecking catches changes to imported types", async () => {
  const directory = mkdtempSync(join(tmpdir(), "bs-typecheck-cache-"));
  const source = join(directory, "value.ts");
  const cache = join(directory, "cache.tsbuildinfo");

  try {
    writeFileSync(
      join(directory, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          noEmit: true,
          incremental: true,
          tsBuildInfoFile: cache,
          types: [],
          skipLibCheck: true,
        },
        include: ["*.ts"],
      })
    );
    writeFileSync(source, "export interface IValue { value: string; }\n");
    writeFileSync(
      join(directory, "consumer.ts"),
      'import type { IValue } from "./value";\nexport const value: IValue = { value: "valid" };\n'
    );
    const run = () =>
      runProcess(
        [
          process.execPath,
          join(ROOT, "apps/api/node_modules/typescript/bin/tsc"),
          "-p",
          directory,
        ],
        { cwd: directory, timeoutMs: 10_000 }
      );

    const cold = await run();

    expect(cold.code).toBe(0);
    expect(existsSync(cache)).toBe(true);
    const warm = await run();

    expect(warm.code).toBe(0);
    writeFileSync(source, "export interface IValue { value: number; }\n");
    const changed = await run();

    expect(changed.code).not.toBe(0);
    expect(changed.stdout).toContain("consumer.ts");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 30_000);
