import { describe, expect, test } from "bun:test";
import { NoopCacheService } from "../../../../src/lib/cache/providers/noop";

describe("NoopCacheService", () => {
  const cache = new NoopCacheService();

  test("get always returns null", async () => {
    await cache.set("k", "v");
    expect(await cache.get<string>("k")).toBeNull();
  });

  test("has always returns false", async () => {
    await cache.set("k", "v");
    expect(await cache.has("k")).toBe(false);
  });

  test("set / del / close are no-ops that resolve", async () => {
    await cache.set("k", "v");
    await cache.del("k");
    await cache.del(["a", "b"]);
    await cache.close();
    expect(true).toBe(true);
  });

  test("wrap always invokes the factory and returns its result", async () => {
    let calls = 0;

    const factory = (): Promise<string> => {
      calls++;

      return Promise.resolve("fresh");
    };

    expect(await cache.wrap("k", factory)).toBe("fresh");
    expect(await cache.wrap("k", factory)).toBe("fresh");
    expect(calls).toBe(2);
  });

  test("providerName is 'noop'", () => {
    expect(cache.providerName).toBe("noop");
  });
});
