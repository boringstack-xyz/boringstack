import { describe, expect, it } from "vitest";

import { env } from "@/lib/env";

import { namespacedKey } from "./localStorage.utils";

describe("namespacedKey", () => {
  it("prefixes the key with the auth namespace + schema version", () => {
    expect(namespacedKey("favorite")).toBe(
      `${env.VITE_AUTH_NAMESPACE}:v1:favorite`
    );
  });

  it("preserves the literal name (no escaping, no normalization)", () => {
    const key = "some/strange.name with spaces";

    expect(namespacedKey(key)).toBe(`${env.VITE_AUTH_NAMESPACE}:v1:${key}`);
  });

  it("produces distinct keys for distinct names", () => {
    expect(namespacedKey("a")).not.toBe(namespacedKey("b"));
  });
});
