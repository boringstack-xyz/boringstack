import { describe, expect, test } from "bun:test";

import { createApp } from "../../../src/config/app";
import { initializeErrorHandlers } from "../../../src/config/error-handlers";
import { cacheService } from "../../../src/lib/cache";
import { postgresClient } from "../../helpers/db";

describe("error-handlers", () => {
  test("SIGTERM stops HTTP listener before cache and database teardown", async () => {
    const order: string[] = [];
    const app = createApp();
    const server = app.listen(0);

    const originalStop = server.stop.bind(server);
    const originalCacheClose = cacheService.close.bind(cacheService);
    const originalDbEnd = postgresClient.end.bind(postgresClient);
    const originalExitDescriptor = Object.getOwnPropertyDescriptor(
      process,
      "exit"
    );

    server.stop = async () => {
      order.push("http");

      return originalStop();
    };

    cacheService.close = async (): Promise<void> => {
      order.push("cache");
      await Promise.resolve();
    };

    postgresClient.end = async (): Promise<void> => {
      order.push("db");
      await Promise.resolve();
    };

    let exitCode: number | undefined;

    Object.defineProperty(process, "exit", {
      configurable: true,
      writable: true,
      value: (code?: number | string | null) => {
        exitCode = typeof code === "number" ? code : 0;
      },
    });

    try {
      initializeErrorHandlers(server);
      process.emit("SIGTERM");

      await new Promise<void>((resolve, reject) => {
        const started = Date.now();

        const poll = (): void => {
          if (exitCode !== undefined) {
            resolve();

            return;
          }

          if (Date.now() - started > 5_000) {
            reject(new Error("graceful shutdown did not finish within 5s"));

            return;
          }

          setTimeout(poll, 25);
        };

        poll();
      });

      expect(order.indexOf("http")).toBeGreaterThanOrEqual(0);
      expect(order.indexOf("cache")).toBeGreaterThan(order.indexOf("http"));
      expect(order.indexOf("db")).toBeGreaterThan(order.indexOf("cache"));
      expect(exitCode).toBe(0);
    } finally {
      server.stop = originalStop;
      cacheService.close = originalCacheClose;
      postgresClient.end = originalDbEnd;

      if (originalExitDescriptor !== undefined) {
        Object.defineProperty(process, "exit", originalExitDescriptor);
      }
    }
  });
});
