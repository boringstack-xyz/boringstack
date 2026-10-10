import { describe, expect, it, vi } from "vitest";

import {
  DEVTOOLS_STORAGE_KEY,
  type IDevtoolsStorage,
  resolveDevtoolsEnabled
} from "./QueryProvider.devtools";

function memoryStorage(initial: Record<string, string> = {}): IDevtoolsStorage {
  const data = new Map(Object.entries(initial));

  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    }
  };
}

describe("resolveDevtoolsEnabled", () => {
  it("is off by default", () => {
    expect(resolveDevtoolsEnabled("", memoryStorage())).toBe(false);
  });

  it("turns on for a bare ?devtools flag and remembers it", () => {
    const storage = memoryStorage();

    expect(resolveDevtoolsEnabled("?devtools", storage)).toBe(true);
    expect(storage.getItem(DEVTOOLS_STORAGE_KEY)).toBe("1");
  });

  it("keeps the choice for later navigations in the same session", () => {
    const storage = memoryStorage({ [DEVTOOLS_STORAGE_KEY]: "1" });

    expect(resolveDevtoolsEnabled("/dashboard", storage)).toBe(true);
  });

  it("?devtools=0 turns it off and overrides a stored on", () => {
    const storage = memoryStorage({ [DEVTOOLS_STORAGE_KEY]: "1" });

    expect(resolveDevtoolsEnabled("?devtools=0", storage)).toBe(false);
    expect(storage.getItem(DEVTOOLS_STORAGE_KEY)).toBe("0");
  });

  it("ignores unrelated query params", () => {
    expect(resolveDevtoolsEnabled("?devtoolsish=1", memoryStorage())).toBe(
      false
    );
  });

  it("works without storage and does not throw when storage throws", () => {
    expect(resolveDevtoolsEnabled("?devtools", null)).toBe(true);

    const broken: IDevtoolsStorage = {
      getItem: vi.fn(() => {
        throw new Error("blocked");
      }),
      setItem: vi.fn(() => {
        throw new Error("blocked");
      })
    };

    expect(resolveDevtoolsEnabled("", broken)).toBe(false);
    expect(resolveDevtoolsEnabled("?devtools", broken)).toBe(true);
  });
});
