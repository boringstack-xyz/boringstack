import { describe, expect, test } from "bun:test";

import { now } from "../../../src/lib/time/now";

const ISO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

describe("now()", () => {
  test("returns an ISO 8601 UTC timestamp", () => {
    expect(now()).toMatch(ISO_REGEX);
  });

  test("returns the current time", () => {
    const before = Date.now();
    const value = now();
    const after = Date.now();
    const parsed = Date.parse(value);

    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);
  });

  test("returns a UTC timestamp ending in Z", () => {
    expect(now()).toMatch(/Z$/);
  });

  test("includes three-digit millisecond precision", () => {
    expect(now()).toMatch(/\.\d{3}Z$/);
  });

  test("consecutive calls are monotonically non-decreasing", () => {
    const a = Date.parse(now());
    const b = Date.parse(now());

    expect(b).toBeGreaterThanOrEqual(a);
  });
});
