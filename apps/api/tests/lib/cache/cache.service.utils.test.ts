import { describe, expect, test } from "bun:test";

import { buildCacheService } from "../../../src/lib/cache/cache.service.utils";

describe("buildCacheService", () => {
  test("returns a cache service with the full ICacheService contract", () => {
    const cache = buildCacheService();

    expect(cache).toBeDefined();
    expect(typeof cache.get).toBe("function");
    expect(typeof cache.set).toBe("function");
    expect(typeof cache.del).toBe("function");
    expect(typeof cache.has).toBe("function");
    expect(typeof cache.wrap).toBe("function");
    expect(typeof cache.close).toBe("function");
    expect(typeof cache.providerName).toBe("string");
  });

  test("providerName is one of the known providers", () => {
    const cache = buildCacheService();
    const valid: readonly string[] = ["memory", "valkey", "noop"];

    expect(valid.includes(cache.providerName)).toBe(true);
  });

  test("get returns null on cache miss (all providers)", async () => {
    const cache = buildCacheService();
    const result = await cache.get<string>("nonexistent_key_for_test");

    expect(result).toBeNull();
  });

  test("set and get round-trip a value", async () => {
    const cache = buildCacheService();

    await cache.set(
      "test_roundtrip_key",
      { greet: "hello" },
      {
        ttlSeconds: 10,
      }
    );
    const result = await cache.get<{ greet: string }>("test_roundtrip_key");

    expect(result).toEqual({ greet: "hello" });

    // Cleanup
    await cache.del("test_roundtrip_key");
  });

  test("has returns true after set", async () => {
    const cache = buildCacheService();

    await cache.set("test_has_key", "value", { ttlSeconds: 10 });

    expect(await cache.has("test_has_key")).toBe(true);

    await cache.del("test_has_key");
  });
});
