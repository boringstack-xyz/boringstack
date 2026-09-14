import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { hostEnvironment } from "./environment";
import { runProcess } from "./process";

test("an explicitly requested unreachable integration database cannot report success", async () => {
  const root = fileURLToPath(new URL("../../apps/api/", import.meta.url));
  const fixture = mkdtempSync(join(tmpdir(), "bs-db-contract-"));
  const path = join(fixture, "database.test.ts");

  try {
    writeFileSync(
      path,
      `import { test } from "bun:test";
import { requireDb } from ${JSON.stringify(join(root, "tests/helpers/db.ts"))};
test("database contract", async () => { await requireDb(); });`
    );
    const environment = {
      ...hostEnvironment(),
      NODE_ENV: "test",
      CI: "false",
      REQUIRE_INTEGRATION_DB: "false",
    };
    const offline = await runProcess(
      [process.execPath, "--no-env-file", "test", path],
      {
        cwd: root,
        env: { ...environment, TEST_DATABASE_URL: undefined },
        timeoutMs: 15_000,
      }
    );

    expect(offline.status).toBe("completed");
    expect(offline.code).toBe(0);
    const explicit = await runProcess(
      [process.execPath, "--no-env-file", "test", path],
      {
        cwd: root,
        env: {
          ...environment,
          TEST_DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test",
        },
        timeoutMs: 15_000,
      }
    );

    expect(explicit.status).toBe("completed");
    expect(explicit.code).not.toBe(0);
    expect(explicit.stderr).toContain(
      "Integration database explicitly requested but unreachable"
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}, 35_000);
