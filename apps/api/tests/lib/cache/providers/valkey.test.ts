import { afterAll, describe, expect, test } from "bun:test";

import { ValkeyCacheService } from "../../../../src/lib/cache/providers/valkey";
import { requireValkey } from "../../../helpers/valkey";

let activeCache: ValkeyCacheService | null = null;

const acquireCache = async (): Promise<ValkeyCacheService | null> => {
  if (activeCache !== null) {
    return activeCache;
  }

  if (!(await requireValkey())) {
    return null;
  }

  activeCache = new ValkeyCacheService();

  return activeCache;
};

afterAll(async () => {
  if (activeCache === null) {
    return;
  }

  await activeCache.close().catch(() => undefined);
  activeCache = null;
});

describe("ValkeyCacheService", () => {
  test("providerName is 'valkey'", async () => {
    const cache = new ValkeyCacheService();

    expect(cache.providerName).toBe("valkey");

    await cache.close().catch(() => undefined);
  });

  test("set + get round-trip a value (skipped when Valkey is unreachable)", async () => {
    const cache = await acquireCache();

    if (cache === null) {
      return;
    }

    const key = `roundtrip_${String(Date.now())}`;

    await cache.set(key, { hello: "world" }, { ttlSeconds: 5 });

    const result = await cache.get<{ hello: string }>(key);

    expect(result).toEqual({ hello: "world" });

    await cache.del(key);
  });

  test("get returns null on a miss", async () => {
    const cache = await acquireCache();

    if (cache === null) {
      return;
    }

    const result = await cache.get<string>(
      `definitely_not_set_${String(Date.now())}`
    );

    expect(result).toBeNull();
  });

  test("has reflects set/del state", async () => {
    const cache = await acquireCache();

    if (cache === null) {
      return;
    }

    const key = `has_test_${String(Date.now())}`;

    expect(await cache.has(key)).toBe(false);

    await cache.set(key, "x", { ttlSeconds: 5 });

    expect(await cache.has(key)).toBe(true);

    await cache.del(key);

    expect(await cache.has(key)).toBe(false);
  });

  test("wrap returns cached value on second call without invoking factory again", async () => {
    const cache = await acquireCache();

    if (cache === null) {
      return;
    }

    const key = `wrap_test_${String(Date.now())}`;
    let calls = 0;

    const factory = (): Promise<number> => {
      calls += 1;

      return Promise.resolve(42);
    };

    const first = await cache.wrap(key, factory, { ttlSeconds: 5 });
    const second = await cache.wrap(key, factory, { ttlSeconds: 5 });

    expect(first).toBe(42);
    expect(second).toBe(42);
    expect(calls).toBe(1);

    await cache.del(key);
  });
});
