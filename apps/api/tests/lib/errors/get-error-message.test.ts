import { describe, expect, test } from "bun:test";
import { getErrorMessage } from "../../../src/lib/errors";

describe("getErrorMessage", () => {
  test("Error → message", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
  });

  test("Error with cause → appends cause", () => {
    const inner = new Error("network down");
    const outer = new Error("send failed", { cause: inner });

    expect(getErrorMessage(outer)).toBe(
      "send failed (caused by: network down)"
    );
  });

  test("string → string", () => {
    expect(getErrorMessage("plain")).toBe("plain");
  });

  test("null/undefined → 'Unknown error'", () => {
    expect(getErrorMessage(null)).toBe("Unknown error");
    expect(getErrorMessage(undefined)).toBe("Unknown error");
  });

  test("object → JSON-stringified", () => {
    expect(getErrorMessage({ code: 500, message: "x" })).toBe(
      '{"code":500,"message":"x"}'
    );
  });

  test("circular object → 'Unknown error' (does not throw)", () => {
    const a: Record<string, unknown> = {};

    a.self = a;
    expect(getErrorMessage(a)).toBe("Unknown error");
  });
});
