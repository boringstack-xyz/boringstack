import { describe, expect, test } from "bun:test";

import {
  bumpGeneration,
  generationScopedKey,
  readGeneration,
} from "../../../src/lib/cache/cache.generation";
import { cacheService } from "../../../src/lib/cache/cache.service";

const namespace = (): string =>
  `gen_test_${String(Date.now())}_${String(Math.random()).slice(2)}`;

describe("cache generations", () => {
  test("an untouched namespace is at generation 0 and keys carry it", async () => {
    const ns = namespace();

    expect(await readGeneration(ns)).toBe(0);
    expect(await generationScopedKey(ns, "list", "abc")).toBe(
      `cache:${ns}:v0:list:abc`
    );
  });

  test("bumping moves every scoped key so cached reads become unreachable", async () => {
    const ns = namespace();
    const before = await generationScopedKey(ns, "list");

    await cacheService.set(before, ["stale"], { ttlSeconds: 60 });

    expect(await bumpGeneration(ns)).toBe(1);
    expect(await readGeneration(ns)).toBe(1);

    const after = await generationScopedKey(ns, "list");

    expect(after).not.toBe(before);
    expect(await cacheService.get<string[]>(after)).toBeNull();
    expect(await cacheService.get<string[]>(before)).toEqual(["stale"]);
  });

  test("bumps are cumulative and return the new generation", async () => {
    const ns = namespace();

    await bumpGeneration(ns);
    expect(await bumpGeneration(ns)).toBe(2);
    expect(await generationScopedKey(ns, "x")).toBe(`cache:${ns}:v2:x`);
  });
});
