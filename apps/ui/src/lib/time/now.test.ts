import { describe, expect, test } from "vitest";

import { now } from "./now";

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
});
