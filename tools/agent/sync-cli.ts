import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runProcess } from "./process";
import type { ICheckResult } from "./result";
import { startRuntime, type IRuntime } from "./runtime";
import { acquireLease } from "./sandbox/lease";
import { inspectSandbox, sandboxEnv } from "./sandbox/lifecycle";
import { checkOpenapi } from "./verification";
import { acquireWorkspace } from "./workspace-lock";

const root = fileURLToPath(new URL("../../", import.meta.url));
const args = process.argv.slice(2).filter((arg) => arg !== "--");
const checks: ICheckResult[] = [];
let runtime: IRuntime | undefined;
let releaseWorkspace: (() => void) | undefined;
let release: (() => void) | undefined;
const controller = new AbortController();

process.once("SIGINT", () => {
  controller.abort();
});
process.once("SIGTERM", () => {
  controller.abort();
});

try {
  const id = args.find((arg) => arg.startsWith("--sandbox="))?.slice(10);

  if (
    id === undefined ||
    id === "" ||
    args.filter((arg) => arg.startsWith("--sandbox=")).length !== 1 ||
    args.some((arg) => arg !== "--json" && !arg.startsWith("--sandbox="))
  ) {
    throw new Error("Invalid sync arguments");
  }

  releaseWorkspace = acquireWorkspace(root);
  release = acquireLease(root, id);
  const sandbox = await inspectSandbox(root, id);
  const env = sandboxEnv(sandbox);

  for (const script of [
    "db:migrate",
    "build:templates",
    "generate:acl-types",
  ]) {
    const run = await runProcess(
      [process.execPath, "--no-env-file", "run", script],
      { cwd: join(root, "apps/api"), env, signal: controller.signal }
    );

    if (run.code !== 0) {
      throw new Error("Sync prerequisite failed");
    }

    checks.push({
      checkId: `api.${script}`,
      status: "passed",
      reason: "command_passed",
    });
  }

  runtime = await startRuntime(root, sandbox, controller.signal);
  const run = await runProcess(
    [process.execPath, "--no-env-file", "scripts/codegen/generate-api.ts"],
    {
      cwd: join(root, "apps/ui"),
      env: runtime.env,
      signal: controller.signal,
      timeoutMs: 30_000,
    }
  );

  if (run.code !== 0) {
    throw new Error("Contract generation failed");
  }

  checks.push(
    await checkOpenapi(
      root,
      `${runtime.apiUrl}/swagger/json`,
      30_000,
      controller.signal
    )
  );
} catch {
  checks.push({
    checkId: "sync.completed",
    status: "blocked",
    reason: "sync_prerequisite_failed",
  });
} finally {
  await runtime?.stop();
  release?.();
  releaseWorkspace?.();
}

const status = checks.some((check) => check.status === "blocked")
  ? "blocked"
  : checks.some((check) => check.status === "failed")
    ? "failed"
    : "passed";

console.log(
  JSON.stringify({
    schemaVersion: 1,
    kind: "contract-generation",
    status,
    checks,
    reviewPaths: [
      "apps/ui/src/lib/acl/acl.types.generated.ts",
      "apps/ui/src/lib/api/schema.d.ts",
    ],
  })
);
process.exitCode = status === "passed" ? 0 : status === "failed" ? 1 : 2;
