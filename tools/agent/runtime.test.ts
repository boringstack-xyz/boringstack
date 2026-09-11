import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { startRuntime } from "./runtime";
import type { ISandbox } from "./sandbox/lifecycle";

test("owned runtime launches the UI under Node and verifies the IPv4 proxy", async () => {
  const root = mkdtempSync(join(tmpdir(), "bs-runtime-test-"));
  const files = {
    "apps/api/src/config/app/app.ts": `export function createApp() {
      return { server: undefined, use() { return this; }, listen(options) {
        this.server = Bun.serve({...options, fetch: () => Response.json({ready:true})});
        return this;
      }};
    }`,
    "apps/api/src/config/setup/index.ts":
      "export function setupNotifications() {}",
    "apps/api/src/config/swagger/swagger.ts":
      "export const swaggerConfig = {};",
    "apps/ui/package.json": '{"type":"module"}',
    "apps/ui/node_modules/vite/bin/vite.js": `import {createServer} from "node:http";
      if (process.versions.bun !== undefined) throw new Error("Vite requires the Node runtime");
      const port=Number(process.argv[process.argv.indexOf("--port")+1]);
      createServer(async (_request,response) => {
        const upstream=await fetch(process.env.VITE_API_PROXY_TARGET+"/api/v1/capabilities");
        response.writeHead(upstream.status,{"content-type":"application/json"});
        response.end(await upstream.text());
      }).listen(port,"127.0.0.1");`,
  };
  const state: ISandbox = {
    version: 1,
    id: "fixture",
    owner: "fixture",
    root,
    createdAt: "fixture",
    password: "fixture",
    valkeyPassword: "fixture",
    postgres: "unused",
    valkey: "unused",
    postgresPort: 1,
    valkeyPort: 1,
  };

  try {
    for (const [path, source] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), source);
    }

    const runtime = await startRuntime(root, state, AbortSignal.timeout(5000));

    try {
      expect(runtime.uiUrl).toStartWith("http://localhost:");
      const response = await fetch(`${runtime.uiUrl}/api/v1/capabilities`);

      expect(response.status).toBe(200);
    } finally {
      await runtime.stop();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 10_000);
