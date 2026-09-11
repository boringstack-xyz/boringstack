import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { identifyCheckout } from "./checkout";
import { exitCode, parseEvidence } from "./result";
import { requireValue } from "./validation";
import { checkOpenapi, verify } from "./verification";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const roots: string[] = [];
const servers: ReturnType<typeof Bun.serve>[] = [];

afterEach(async () => {
  for (const instance of servers.splice(0)) {
    await instance.stop(true);
  }

  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "agent verification "));

  roots.push(root);
  const ui = join(root, "apps/ui");

  mkdirSync(join(ui, "scripts/codegen"), { recursive: true });
  mkdirSync(join(ui, "src/lib/api"), { recursive: true });
  const files = [
    "scripts/codegen/generate-api.ts",
    "src/lib/errors/getErrorMessage.ts",
  ];

  for (const file of files) {
    mkdirSync(dirname(join(ui, file)), { recursive: true });
    cpSync(join(repo, "apps/ui", file), join(ui, file));
  }

  symlinkSync(join(repo, "apps/ui/node_modules"), join(ui, "node_modules"));
  writeFileSync(join(root, ".gitignore"), "node_modules/\n");
  execFileSync("git", ["init", "-q", root]);
  execFileSync("git", ["-C", root, "add", "."]);
  execFileSync("git", [
    "-C",
    root,
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.com",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-qm",
    "fixture",
  ]);

  return root;
}

function server(response: () => Response | Promise<Response>): string {
  const instance = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: response,
  });

  servers.push(instance);

  return `http://127.0.0.1:${requireValue(instance.port, "Test server has no port")}/swagger/json`;
}

const spec = {
  openapi: "3.0.3",
  info: { title: "Test", version: "1" },
  paths: {},
};

async function generate(root: string, url: string): Promise<void> {
  const child = Bun.spawn(
    [process.execPath, "scripts/codegen/generate-api.ts"],
    {
      cwd: join(root, "apps/ui"),
      env: { ...process.env, OPENAPI_URL: url },
      stdout: "ignore",
      stderr: "ignore",
    }
  );

  expect(await child.exited).toBe(0);
}

describe("evidence contract", () => {
  test("preserves a completed failure and its exit code", () => {
    const result = parseEvidence(
      JSON.stringify({
        schemaVersion: 1,
        checkId: "openapi.drift",
        status: "failed",
        reason: "schema_drift",
      }),
      1
    );

    expect(result.status).toBe("failed");
    expect(exitCode(result.status)).toBe(1);
  });
  test.each([
    "",
    "success",
    "{}",
    '{"schemaVersion":2}',
    'log\n{"status":"passed"}',
  ])("rejects incomplete or malformed output: %s", (stdout) => {
    expect(parseEvidence(stdout, 0).status).toBe("blocked");
  });
  test("rejects passing output from a failed process", () => {
    expect(
      parseEvidence(
        JSON.stringify({
          schemaVersion: 1,
          checkId: "openapi.drift",
          status: "passed",
          reason: "schema_matches",
        }),
        1
      ).status
    ).toBe("blocked");
  });
});

describe("real OpenAPI adapter", () => {
  test("matching schema passes from a path with spaces", async () => {
    const root = fixture();
    const url = server(() => Response.json(spec));

    await generate(root, url);
    const result = await verify(root, url);

    expect(result.status).toBe("passed");
    expect(result.checkout?.fingerprint).toHaveLength(64);
    expect(exitCode(result.status)).toBe(0);
  });
  test("schema drift fails without regenerating the file", async () => {
    const root = fixture();

    writeFileSync(
      join(root, "apps/ui/src/lib/api/schema.d.ts"),
      "// deliberately stale\n"
    );
    const result = await checkOpenapi(
      root,
      server(() => Response.json(spec))
    );

    expect(result).toMatchObject({ status: "failed", reason: "schema_drift" });
    expect(
      await Bun.file(join(root, "apps/ui/src/lib/api/schema.d.ts")).text()
    ).toBe("// deliberately stale\n");
  });
  test("missing schema is a completed contract failure", async () => {
    expect(
      await checkOpenapi(
        fixture(),
        server(() => Response.json(spec))
      )
    ).toMatchObject({ status: "failed", reason: "schema_missing" });
  });
  test("closed endpoint blocks instead of passing", async () => {
    const url = server(() => Response.json(spec));

    await servers.pop()?.stop(true);
    const result = await checkOpenapi(fixture(), url);

    expect(result.status).toBe("blocked");
    expect(exitCode(result.status)).toBe(2);
  });
  test("invalid API document blocks and does not leak URL credentials", async () => {
    const url =
      server(() => new Response("invalid")) + "?token=CANARY_PRIVATE_VALUE";
    const result = await checkOpenapi(fixture(), url);

    expect(result.status).toBe("blocked");
    expect(JSON.stringify(result)).not.toContain("CANARY_PRIVATE_VALUE");
  });
  test("deadline blocks a stalled generator", async () => {
    const root = fixture();

    // An active interval guarantees the process remains alive while awaiting.
    writeFileSync(
      join(root, "apps/ui/scripts/codegen/generate-api.ts"),
      "setInterval(() => {}, 1000); await new Promise(() => {});"
    );
    expect(await checkOpenapi(root, "http://127.0.0.1", 100)).toMatchObject({
      status: "blocked",
      reason: "check_timeout",
    });
  });
  test("crashed generator cannot pass", async () => {
    const root = fixture();

    writeFileSync(
      join(root, "apps/ui/scripts/codegen/generate-api.ts"),
      'throw new Error("CANARY_PRIVATE_VALUE");'
    );
    const result = await checkOpenapi(root, "http://127.0.0.1");

    expect(result.status).toBe("blocked");
    expect(JSON.stringify(result)).not.toContain("CANARY_PRIVATE_VALUE");
  });
  test("checkout edits invalidate otherwise passing evidence", async () => {
    const root = fixture();
    let mutate = false;
    const url = server(() => {
      if (mutate) {
        writeFileSync(
          join(root, "new-feature.ts"),
          "export const changed = true;"
        );
      }

      return Response.json(spec);
    });

    await generate(root, url);
    mutate = true;
    const result = await verify(root, url);

    expect(result.status).toBe("blocked");
    expect(
      result.checks.some((check) => check.reason === "checkout_changed")
    ).toBe(true);
  });
  test("untracked changes alter the checkout fingerprint", () => {
    const root = fixture();
    const before = identifyCheckout(root);

    writeFileSync(join(root, "untracked.ts"), "export {};");
    expect(identifyCheckout(root).fingerprint).not.toBe(before.fingerprint);
  });
});
