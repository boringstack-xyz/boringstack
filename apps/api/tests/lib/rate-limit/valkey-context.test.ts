import { describe, expect, spyOn, test } from "bun:test";
import { Redis } from "ioredis";

import { logger } from "../../../src/config/logger";
import { ValkeyRateLimitContext } from "../../../src/lib/rate-limit/valkey-context";

/*
 * `lazyConnect` keeps ioredis from opening a socket: the misconfiguration
 * path returns before issuing any command, so the client is never touched.
 */
const makeContext = (): { ctx: ValkeyRateLimitContext; client: Redis } => {
  const client = new Redis({ lazyConnect: true });

  return { ctx: new ValkeyRateLimitContext(client), client };
};

const countMisconfigWarns = (calls: unknown[]): number =>
  (JSON.stringify(calls).match(/rate_limit_misconfigured/gu) ?? []).length;

describe("ValkeyRateLimitContext non-positive window", () => {
  test("fails open and warns when the window is non-positive", async () => {
    const { ctx, client } = makeContext();
    const warnSpy = spyOn(logger, "warn");

    try {
      const result = await ctx.increment("user:1", 0, 1_000);

      expect(result.count).toBe(1);
      expect(countMisconfigWarns(warnSpy.mock.calls)).toBe(1);
    } finally {
      warnSpy.mockRestore();
      client.disconnect();
    }
  });

  test("throttles the warning so the hot path does not flood the log", async () => {
    const { ctx, client } = makeContext();
    const warnSpy = spyOn(logger, "warn");

    try {
      await ctx.increment("user:1", 0, 1_000);
      await ctx.increment("user:1", 0, 1_500);

      expect(countMisconfigWarns(warnSpy.mock.calls)).toBe(1);
    } finally {
      warnSpy.mockRestore();
      client.disconnect();
    }
  });
});
