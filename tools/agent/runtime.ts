import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { inventoryEvidence } from "./inventory";
import { runProcess } from "./process";
import { testEvidence } from "./reports";
import type { ICheckResult } from "./result";
import { sandboxEnv, type ISandbox } from "./sandbox/lifecycle";
import { isAborted, parseRecord, requireValue } from "./validation";
import { checkOpenapi } from "./verification";

export interface IRuntime {
  apiUrl: string;
  uiUrl: string;
  env: Record<string, string>;
  stop: () => Promise<void>;
}

export async function startRuntime(
  root: string,
  state: ISandbox,
  signal?: AbortSignal
): Promise<IRuntime> {
  const dir = join(root, ".agent-state", `runtime-${randomUUID()}`);

  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const children: ChildProcess[] = [];
  const failedChildren = new Set<ChildProcess>();

  const stop = async (): Promise<void> => {
    signal?.removeEventListener("abort", abort);
    await Promise.all(
      children.map(
        (child) =>
          new Promise<void>((resolve) => {
            if (child.exitCode !== null || child.signalCode !== null) {
              resolve();

              return;
            }

            child.once("close", () => {
              resolve();
            });

            try {
              if (child.pid !== undefined) {
                process.kill(-child.pid, "SIGKILL");
              }
            } catch {
              resolve();
            }
          })
      )
    );
    rmSync(dir, { recursive: true, force: true });
  };

  const abort = (): void => {
    void stop();
  };

  signal?.addEventListener("abort", abort, { once: true });

  const launch = (
    args: string[],
    cwd: string,
    env: Record<string, string>,
    runtime: "bun" | "node" = "bun"
  ): ChildProcess => {
    const child = spawn(
      runtime === "bun" ? process.execPath : "node",
      runtime === "bun" ? ["--no-env-file", ...args] : args,
      {
        cwd,
        env,
        detached: true,
        stdio: "ignore",
      }
    );

    child.on("error", () => {
      failedChildren.add(child);
    });
    children.push(child);

    return child;
  };

  try {
    if (isAborted(signal)) {
      throw new Error("Interrupted");
    }

    const reservation = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: () => new Response(),
    });
    const uiPort = requireValue(reservation.port, "UI reservation has no port");

    await reservation.stop(true);
    const uiUrl = `http://localhost:${uiPort}`;
    const env = {
      ...sandboxEnv(state),
      QUEUES_ENABLED: "false",
      ACCOUNT_DOMAIN_CLAIMING: "false",
      FRONTEND_URL: uiUrl,
      ALLOWED_ORIGINS: uiUrl,
      E2E_TEST_ENDPOINTS_ENABLED: "true",
      OTEL_EXPORTER_OTLP_ENDPOINT: "",
      VITE_API_URL: "",
      PLAYWRIGHT_PORT: String(uiPort),
      PLAYWRIGHT_REUSE_SERVER: "true",
      E2E_API_BASE_URL: uiUrl,
    };
    const app = pathToFileURL(
      join(root, "apps/api/src/config/app/app.ts")
    ).href;
    const swagger = pathToFileURL(
      join(root, "apps/api/src/config/swagger/swagger.ts")
    ).href;
    const setup = pathToFileURL(
      join(root, "apps/api/src/config/setup/index.ts")
    ).href;
    const portFile = join(dir, "api.json");
    const entry = join(dir, "api.ts");

    writeFileSync(
      entry,
      `import { createApp } from ${JSON.stringify(app)};
import { setupNotifications } from ${JSON.stringify(setup)};
import { swaggerConfig } from ${JSON.stringify(swagger)};

setupNotifications();

const application = createApp()
  .use(swaggerConfig)
  .listen({ hostname: "127.0.0.1", port: 0 });

await Bun.write(
  ${JSON.stringify(portFile)},
  JSON.stringify({ port: application.server?.port })
);
`,
      { mode: 0o600 }
    );
    const api = launch([entry], join(root, "apps/api"), env);

    for (let i = 0; !existsSync(portFile); i++) {
      if (
        i > 240 ||
        api.exitCode !== null ||
        failedChildren.has(api) ||
        isAborted(signal)
      ) {
        throw new Error("API startup failed");
      }

      await Bun.sleep(250);
    }

    const port: unknown = parseRecord(readFileSync(portFile, "utf8")).port;

    if (typeof port !== "number" || port < 1 || port > 65535) {
      throw new Error("Invalid API port");
    }

    const apiUrl = `http://127.0.0.1:${port}`;
    const fullEnv = {
      ...env,
      PUBLIC_API_URL: `${uiUrl}/api`,
      VITE_API_PROXY_TARGET: apiUrl,
      OPENAPI_URL: `${apiUrl}/swagger/json`,
    };
    const ui = launch(
      [
        "node_modules/vite/bin/vite.js",
        "--host",
        "127.0.0.1",
        "--port",
        String(uiPort),
        "--strictPort",
      ],
      join(root, "apps/ui"),
      fullEnv,
      "node"
    );

    let readiness = "not probed";

    for (let i = 0; ; i++) {
      if (
        i > 240 ||
        ui.exitCode !== null ||
        failedChildren.has(ui) ||
        isAborted(signal)
      ) {
        throw new Error(
          `UI startup failed (${readiness}; exit=${String(ui.exitCode)})`
        );
      }

      try {
        const response = await fetch(
          `http://127.0.0.1:${uiPort}/api/v1/capabilities`,
          {
            signal: AbortSignal.timeout(1000),
          }
        );

        readiness = `HTTP ${String(response.status)}`;

        if (response.ok) {
          break;
        }
      } catch (error) {
        readiness = error instanceof Error ? error.name : "connection failed";
      }

      await Bun.sleep(250);
    }

    return { apiUrl, uiUrl, env: fullEnv, stop };
  } catch (error) {
    await stop();

    throw error;
  }
}

export async function fullStackChecks(
  root: string,
  state: ISandbox,
  signal?: AbortSignal,
  expectedFingerprint?: string
): Promise<ICheckResult[]> {
  let runtime: IRuntime | undefined;
  const report = join(root, ".agent-state", `playwright-${randomUUID()}.xml`);

  try {
    runtime = await startRuntime(root, state, signal);
    const schema = await checkOpenapi(
      root,
      `${runtime.apiUrl}/swagger/json`,
      30_000,
      signal
    );
    const run = await runProcess(
      [
        "node",
        "node_modules/@playwright/test/cli.js",
        "test",
        "--project=chromium",
        "--retries=0",
        "--grep-invert=Visual regression",
        "--reporter=junit",
      ],
      {
        cwd: join(root, "apps/ui"),
        env: { ...runtime.env, PLAYWRIGHT_JUNIT_OUTPUT_FILE: report },
        signal,
        timeoutMs: 600_000,
      }
    );
    const browser =
      run.status === "blocked"
        ? { checkId: "ui.e2e", status: "blocked" as const, reason: run.reason }
        : testEvidence(
            "ui.e2e",
            existsSync(report) ? readFileSync(report, "utf8") : "",
            run.code,
            "playwright"
          );

    return [
      schema,
      inventoryEvidence(
        root,
        "ui.e2e",
        existsSync(report) ? readFileSync(report, "utf8") : "",
        browser,
        expectedFingerprint
      ),
    ];
  } catch {
    return [
      {
        checkId: "runtime.ready",
        status: "blocked",
        reason: "owned_runtime_unavailable",
      },
    ];
  } finally {
    await runtime?.stop();
    rmSync(report, { force: true });
  }
}
