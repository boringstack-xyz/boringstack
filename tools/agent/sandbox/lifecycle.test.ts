import { expect, test } from "bun:test";
import { createConnection } from "node:net";
import { fileURLToPath } from "node:url";

import { dockerTestsEnabled } from "../environment";
import { runProcess } from "../process";
import { acquireLease } from "./lease";
import {
  downSandbox,
  inspectSandbox,
  publicSandbox,
  readSandbox,
  upSandbox,
  type ISandbox,
} from "./lifecycle";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

function ping(port: number, password?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    let response = "";

    socket.setTimeout(3000, () => socket.destroy(new Error("Probe timed out")));
    socket.on("connect", () => {
      const authentication =
        password === undefined ? "" : `AUTH ${password}\r\n`;

      socket.write(`${authentication}PING\r\n`);
    });
    socket.on("data", (chunk) => {
      response += chunk.toString();

      if (!/PONG|NOAUTH|WRONGPASS/.test(response)) {
        return;
      }

      socket.destroy();
      resolve(response);
    });
    socket.on("error", reject);
  });
}

async function cacheCommand(state: ISandbox, ...args: string[]) {
  return runProcess(
    [
      "docker",
      "exec",
      "-e",
      `REDISCLI_AUTH=${state.valkeyPassword}`,
      state.valkey,
      "valkey-cli",
      ...args,
    ],
    { cwd: ROOT }
  );
}

async function query(state: ISandbox, sql: string) {
  return runProcess(
    [
      "docker",
      "exec",
      "-e",
      `PGPASSWORD=${state.password}`,
      state.postgres,
      "psql",
      "-h",
      "127.0.0.1",
      "-U",
      "app",
      "-d",
      "app",
      "-At",
      "-c",
      sql,
    ],
    { cwd: ROOT }
  );
}

test("refuses invalid IDs before touching Docker", () => {
  expect(() => readSandbox(ROOT, "../../other")).toThrow();
});

// Docker tests run only in their explicit lane; omitted integration work is not evidence.
if (dockerTestsEnabled()) {
  test("two disposable environments have independent state and cleanup", async () => {
    const first = await upSandbox(ROOT);
    let second: ISandbox | undefined;
    let firstRemoved = false;

    try {
      second = await upSandbox(ROOT);
      const publicDescriptor = JSON.stringify(publicSandbox(first));

      expect(publicDescriptor).not.toContain(first.password);
      expect(publicDescriptor).not.toContain(first.valkeyPassword);
      expect(first.postgresPort).not.toBe(second.postgresPort);
      expect(first.valkeyPort).not.toBe(second.valkeyPort);
      expect(await ping(first.valkeyPort)).toContain("NOAUTH");
      expect(await ping(first.valkeyPort, second.valkeyPassword)).toMatch(
        /WRONGPASS|NOAUTH/
      );
      expect(await ping(first.valkeyPort, first.valkeyPassword)).toContain(
        "PONG"
      );

      const firstWrite = await cacheCommand(
        first,
        "set",
        "shared-test-key",
        "first"
      );
      const secondRead = await cacheCommand(second, "get", "shared-test-key");
      const secondWrite = await cacheCommand(
        second,
        "set",
        "shared-test-key",
        "second"
      );

      expect(firstWrite.code).toBe(0);
      expect(secondRead.stdout.trim()).toBe("");
      expect(secondWrite.code).toBe(0);

      const createMarker = await query(
        first,
        "CREATE TABLE isolation_marker (value text); INSERT INTO isolation_marker VALUES ('first');"
      );
      const absent = await query(
        second,
        "SELECT to_regclass('public.isolation_marker');"
      );

      expect(createMarker.code).toBe(0);
      expect(absent.code).toBe(0);
      expect(absent.stdout.trim()).toBe("");

      const release = acquireLease(ROOT, first.id);

      try {
        expect(() => acquireLease(ROOT, first.id)).toThrow();
        let rejection: unknown;

        try {
          await downSandbox(ROOT, first.id);
        } catch (error) {
          rejection = error;
        }

        expect(rejection).toBeInstanceOf(Error);
        expect(rejection instanceof Error ? rejection.message : "").toBe(
          "Sandbox is in use"
        );
      } finally {
        release();
      }

      await downSandbox(ROOT, first.id);
      firstRemoved = true;
      const remaining = await inspectSandbox(ROOT, second.id);
      const remainingValue = await cacheCommand(
        second,
        "get",
        "shared-test-key"
      );

      expect(remaining.valkey).toBe(second.valkey);
      expect(remainingValue.stdout.trim()).toBe("second");
    } finally {
      if (!firstRemoved) {
        await downSandbox(ROOT, first.id);
      }

      if (second !== undefined) {
        await downSandbox(ROOT, second.id);
      }
    }
  }, 120_000);
}
