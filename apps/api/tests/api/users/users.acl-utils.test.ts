import { describe, expect, test } from "bun:test";

import {
  coerceRole,
  filterToKnownFeatureKeys,
  isFeatureKey,
  isRole,
} from "../../../src/api/users/users.acl-utils";
import { FEATURE_KEYS, ROLES } from "../../../src/lib/acl/acl.constants";

describe("isRole", () => {
  test.each([...ROLES])("accepts canonical role %s", (role) => {
    expect(isRole(role)).toBe(true);
  });

  test("rejects unknown roles", () => {
    expect(isRole("superadmin")).toBe(false);
    expect(isRole("")).toBe(false);
    expect(isRole("OWNER")).toBe(false);
  });
});

describe("coerceRole", () => {
  test("returns the role when valid", () => {
    expect(coerceRole("owner")).toBe("owner");
  });

  test("throws an internal ApiError for unknown roles", () => {
    expect(() => coerceRole("hacker")).toThrow(/Unknown membership role/);
  });
});

describe("isFeatureKey", () => {
  test.each([...FEATURE_KEYS])("accepts known feature key %s", (key) => {
    expect(isFeatureKey(key)).toBe(true);
  });

  test("rejects unknown feature keys", () => {
    expect(isFeatureKey("not.a.real.feature")).toBe(false);
    expect(isFeatureKey("")).toBe(false);
  });
});

describe("filterToKnownFeatureKeys", () => {
  test("keeps rows whose featureKey is in the catalog", () => {
    const knownKey = FEATURE_KEYS[0];
    const rows = [
      { featureKey: knownKey, value: 1 },
      { featureKey: "unknown.feature", value: 2 },
    ];

    const filtered = filterToKnownFeatureKeys(rows);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.featureKey).toBe(knownKey);
    expect(filtered[0]?.value).toBe(1);
  });

  test("returns an empty array when every key is unknown", () => {
    const rows = [
      { featureKey: "a.b.c", payload: {} },
      { featureKey: "x.y.z", payload: {} },
    ];

    expect(filterToKnownFeatureKeys(rows)).toEqual([]);
  });

  test("preserves the original row shape (minus the narrowed key type)", () => {
    const knownKey = FEATURE_KEYS[0];
    const rows = [{ featureKey: knownKey, extra: "kept", nested: { x: 1 } }];

    const filtered = filterToKnownFeatureKeys(rows);

    expect(filtered[0]).toEqual({
      featureKey: knownKey,
      extra: "kept",
      nested: { x: 1 },
    });
  });
});
