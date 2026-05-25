import { describe, expect, test } from "bun:test";
import { MemoryCacheService } from "../../../../src/lib/cache/providers/memory";

const createCache = (): MemoryCacheService => new MemoryCacheService();

describe("MemoryCacheService", () => {
  test("get returns null on miss", async () => {
    const cache = createCache();

    expect(await cache.get<string>("absent")).toBeNull();
  });

  test("set then get returns the stored value", async () => {
    const cache = createCache();

    await cache.set("k", { name: "Jane", age: 30 });
    const value = await cache.get<{ name: string; age: number }>("k");

    expect(value).toEqual({ name: "Jane", age: 30 });
  });

  test("has reflects presence", async () => {
    const cache = createCache();

    expect(await cache.has("k")).toBe(false);
    await cache.set("k", 1);
    expect(await cache.has("k")).toBe(true);
  });

  test("del removes a single key", async () => {
    const cache = createCache();

    await cache.set("k", 1);
    await cache.del("k");
    expect(await cache.has("k")).toBe(false);
  });

  test("del removes multiple keys at once", async () => {
    const cache = createCache();

    await cache.set("a", 1);
    await cache.set("b", 2);
    await cache.del(["a", "b"]);
    expect(await cache.has("a")).toBe(false);
    expect(await cache.has("b")).toBe(false);
  });

  test("ttlSeconds expires entries", async () => {
    const cache = createCache();

    await cache.set("k", "value", { ttlSeconds: 0.05 });
    expect(await cache.get<string>("k")).toBe("value");
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(await cache.get<string>("k")).toBeNull();
    expect(await cache.has("k")).toBe(false);
  });

  test("no ttl means the entry persists", async () => {
    const cache = createCache();

    await cache.set("k", "value");
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(await cache.get<string>("k")).toBe("value");
  });

  test("wrap returns cached value on second call without invoking factory", async () => {
    const cache = createCache();
    let factoryCalls = 0;

    const factory = (): Promise<number> => {
      factoryCalls++;

      return Promise.resolve(42);
    };

    expect(await cache.wrap("k", factory)).toBe(42);
    expect(await cache.wrap("k", factory)).toBe(42);
    expect(factoryCalls).toBe(1);
  });

  test("wrap respects ttlSeconds", async () => {
    const cache = createCache();
    let factoryCalls = 0;

    const factory = (): Promise<string> => {
      factoryCalls++;

      return Promise.resolve("fresh");
    };

    await cache.wrap("k", factory, { ttlSeconds: 0.05 });
    await new Promise((resolve) => setTimeout(resolve, 80));
    await cache.wrap("k", factory, { ttlSeconds: 0.05 });
    expect(factoryCalls).toBe(2);
  });

  test("close clears the store", async () => {
    const cache = createCache();

    await cache.set("k", 1);
    await cache.close();
    expect(await cache.get<number>("k")).toBeNull();
  });

  test("providerName is 'memory'", () => {
    const cache = createCache();

    expect(cache.providerName).toBe("memory");
  });
});
