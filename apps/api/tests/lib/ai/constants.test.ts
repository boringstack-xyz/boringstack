import { describe, expect, test } from "bun:test";

import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  OPENAI_DEFAULT_BASE_URL,
} from "../../../src/lib/ai/constants";

describe("AI default constants", () => {
  test("DEFAULT_TEMPERATURE is in the [0, 2] sampling range", () => {
    expect(DEFAULT_TEMPERATURE).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_TEMPERATURE).toBeLessThanOrEqual(2);
  });

  test("DEFAULT_MAX_TOKENS is a positive integer", () => {
    expect(DEFAULT_MAX_TOKENS).toBeGreaterThan(0);
    expect(Number.isInteger(DEFAULT_MAX_TOKENS)).toBe(true);
  });

  test("OPENAI_DEFAULT_BASE_URL points at the public API", () => {
    expect(OPENAI_DEFAULT_BASE_URL).toBe("https://api.openai.com/v1");
  });
});
