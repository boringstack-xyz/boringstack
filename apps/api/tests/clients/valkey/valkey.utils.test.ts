import { describe, expect, test } from "bun:test";
import { Redis } from "ioredis";

import {
  getValkeyAppClientOptions,
  getValkeyConnectionOptions,
} from "../../../src/clients/valkey/valkey.utils";

const networkRegressionTest =
  process.env.RUN_VALKEY_NETWORK_TESTS === "true" ? test : test.skip;

describe("getValkeyConnectionOptions", () => {
  test("returns a connection options object with host and port", () => {
    const options = getValkeyConnectionOptions();

    expect(options.host).toBeString();
    expect(typeof options.port).toBe("number");
  });

  test("includes maxRetriesPerRequest set to null (BullMQ requirement)", () => {
    const options = getValkeyConnectionOptions();

    expect(options.maxRetriesPerRequest).toBeNull();
  });

  test("returns a consistent shape on repeated calls", () => {
    const first = getValkeyConnectionOptions();
    const second = getValkeyConnectionOptions();

    expect(first.host).toBe(second.host);
    expect(first.port).toBe(second.port);
    expect(first.db).toBe(second.db);
  });
});

describe("getValkeyAppClientOptions", () => {
  test("returns the fail-fast profile", () => {
    const options = getValkeyAppClientOptions();

    expect(options.maxRetriesPerRequest).toBe(1);
    expect(options.lazyConnect).toBe(true);
    expect(options.connectTimeout).toBe(2000);
  });

  test("does NOT set enableOfflineQueue:false (race with lazyConnect)", () => {
    const options = getValkeyAppClientOptions();

    expect(options.enableOfflineQueue).toBeUndefined();
  });

  test("connectTimeout is overridable", () => {
    const options = getValkeyAppClientOptions({ connectTimeout: 500 });

    expect(options.connectTimeout).toBe(500);
  });
});

describe("regression: unreachable Valkey does not hang the app", () => {
  networkRegressionTest(
    "a command against a closed port rejects within the connect timeout",
    async () => {
      /*
       * Point at a port that is reliably empty. If the fail-fast profile is
       * correctly applied, the command rejects in ~connectTimeout ms
       * instead of hanging until the Bun test runner kills the suite.
       */
      const client = new Redis({
        ...getValkeyAppClientOptions({ connectTimeout: 250 }),
        host: "127.0.0.1",
        port: 16_390,
      });

      const start = Date.now();
      let threw = false;

      try {
        await client.get("any-key");
      } catch {
        threw = true;
      }

      const elapsed = Date.now() - start;

      client.disconnect();

      expect(threw).toBe(true);
      /*
       * Generous upper bound; the point is that it did NOT hang past the
       * Bun per-test timeout (5s).
       */
      expect(elapsed).toBeLessThan(4000);
    }
  );
});
