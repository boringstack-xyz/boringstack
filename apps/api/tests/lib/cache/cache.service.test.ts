import { describe, expect, test } from "bun:test";

import { cacheService } from "../../../src/lib/cache/cache.service";

describe("cacheService (singleton)", () => {
  test("exposes the full ICacheService contract", () => {
    expect(typeof cacheService.get).toBe("function");
    expect(typeof cacheService.set).toBe("function");
    expect(typeof cacheService.del).toBe("function");
    expect(typeof cacheService.has).toBe("function");
    expect(typeof cacheService.wrap).toBe("function");
    expect(typeof cacheService.close).toBe("function");
    expect(typeof cacheService.providerName).toBe("string");
  });

  test("round-trips a value through the singleton (memory provider in test env)", async () => {
    const key = `singleton_roundtrip_${String(Date.now())}`;

    await cacheService.set(key, { hello: "world" }, { ttlSeconds: 5 });

    const result = await cacheService.get<{ hello: string }>(key);

    expect(result).toEqual({ hello: "world" });

    await cacheService.del(key);
  });

  test("del removes a previously set key", async () => {
    const key = `cache_del_${String(Date.now())}`;

    await cacheService.set(key, { x: 1 }, { ttlSeconds: 60 });
    expect(await cacheService.has(key)).toBe(true);

    await cacheService.del(key);

    expect(await cacheService.get(key)).toBeNull();
    expect(await cacheService.has(key)).toBe(false);
  });

  test("wrap returns cached value on second call without invoking factory", async () => {
    const key = `cache_wrap_${String(Date.now())}`;
    let calls = 0;

    const factory = (): Promise<number> => {
      calls += 1;

      return Promise.resolve(99);
    };

    const first = await cacheService.wrap(key, factory, { ttlSeconds: 60 });
    const second = await cacheService.wrap(key, factory, { ttlSeconds: 60 });

    expect(first).toBe(99);
    expect(second).toBe(99);
    expect(calls).toBe(1);
  });
});
