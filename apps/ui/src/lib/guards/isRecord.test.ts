import { describe, expect, test } from "vitest";

import { isRecord } from "./isRecord";

describe("isRecord", () => {
  test("accepts plain objects", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord(Object.create(null))).toBe(true);
  });

  test("accepts class instances and built-in objects", () => {
    expect(isRecord(new Date())).toBe(true);
    expect(isRecord(new Map())).toBe(true);
  });

  test("accepts arrays (indexable by string, callers narrow further)", () => {
    expect(isRecord([])).toBe(true);
    expect(isRecord([1, 2, 3])).toBe(true);
  });

  test("rejects null and undefined", () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
  });

  test("rejects primitives", () => {
    expect(isRecord("string")).toBe(false);
    expect(isRecord(42)).toBe(false);
    expect(isRecord(true)).toBe(false);
    expect(isRecord(Symbol("s"))).toBe(false);
    expect(isRecord(10n)).toBe(false);
  });

  test("rejects functions", () => {
    expect(isRecord(() => undefined)).toBe(false);
  });
});
