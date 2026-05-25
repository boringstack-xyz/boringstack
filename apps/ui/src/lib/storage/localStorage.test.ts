import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { localStore } from "./localStorage";

describe("localStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it("round-trips a value through get/set/remove", () => {
    localStore.set("favorite", { color: "blue" });
    expect(localStore.get("favorite")).toEqual({ color: "blue" });
    localStore.remove("favorite");
    expect(localStore.get("favorite")).toBeNull();
  });

  it("namespaces keys under the configured prefix + version", () => {
    localStore.set("favorite", "x");
    const namespaced = Object.keys(window.localStorage).find((k) =>
      k.endsWith(":favorite")
    );

    expect(namespaced).toMatch(/^[^:]+:v1:favorite$/);
  });

  it("returns null when the key is missing", () => {
    expect(localStore.get("missing")).toBeNull();
  });

  it("returns null and does not throw when JSON is corrupted", () => {
    // Write malformed JSON under the namespaced key
    const allKeys = Object.keys(window.localStorage);

    expect(allKeys).toHaveLength(0);
    localStore.set("good", { ok: true });
    const key = Object.keys(window.localStorage)[0];

    if (key === undefined) {
      throw new Error("expected one stored key");
    }

    window.localStorage.setItem(key, "{ not json");
    expect(localStore.get(key.split(":").pop() ?? "")).toBeNull();
  });

  it("clear() removes only the namespaced keys, not foreign ones", () => {
    window.localStorage.setItem("third-party-key", "untouched");
    localStore.set("a", 1);
    localStore.set("b", 2);
    localStore.clear();
    expect(localStore.get("a")).toBeNull();
    expect(localStore.get("b")).toBeNull();
    expect(window.localStorage.getItem("third-party-key")).toBe("untouched");
  });
});
