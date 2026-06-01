import { describe, expect, test } from "bun:test";

import {
  createSuccessResponse,
  getErrorMessage,
} from "../../../src/lib/errors/errors.utils";

const FAILED_MSG = "request failed";

describe("getErrorMessage", () => {
  test("extracts the message from an Error instance", () => {
    expect(getErrorMessage(new Error("something broke"))).toBe(
      "something broke"
    );
  });

  test("includes cause.message when the error has a cause chain", () => {
    const cause = new Error("upstream timeout");
    const error = new Error(FAILED_MSG, { cause });

    expect(getErrorMessage(error)).toBe(
      `${FAILED_MSG} (caused by: upstream timeout)`
    );
  });

  test("handles cause that is not an Error", () => {
    const error = new Error(FAILED_MSG, { cause: "timeout" });

    // cause is not instanceof Error → no cause clause appended
    expect(getErrorMessage(error)).toBe(FAILED_MSG);
  });

  test("returns the string as-is for string input", () => {
    expect(getErrorMessage("some string error")).toBe("some string error");
  });

  test("returns 'Unknown error' for null", () => {
    expect(getErrorMessage(null)).toBe("Unknown error");
  });

  test("returns 'Unknown error' for undefined", () => {
    expect(getErrorMessage(undefined)).toBe("Unknown error");
  });

  test("returns JSON representation for plain objects", () => {
    expect(getErrorMessage({ code: 500, detail: "boom" })).toBe(
      '{"code":500,"detail":"boom"}'
    );
  });

  test("returns 'Unknown error' for objects that fail JSON.stringify", () => {
    const circular: Record<string, unknown> = {};

    circular.self = circular;

    expect(getErrorMessage(circular)).toBe("Unknown error");
  });

  test("returns string representation for numbers", () => {
    expect(getErrorMessage(42)).toBe("42");
  });
});

describe("createSuccessResponse", () => {
  test("wraps data in the canonical success envelope", () => {
    const response = createSuccessResponse({ id: "u-1", name: "Jane" });

    expect(response.success).toBe(true);
    expect(response.data).toEqual({ id: "u-1", name: "Jane" });
    expect(response.timestamp).toBeString();
    expect(new Date(response.timestamp).getTime()).toBeGreaterThan(0);
  });

  test("allows null data", () => {
    const response = createSuccessResponse(null);

    expect(response.success).toBe(true);
    expect(response.data).toBeNull();
  });

  test("allows primitive data", () => {
    const response = createSuccessResponse("ok");

    expect(response.data).toBe("ok");
  });

  test("attaches a recent ISO 8601 timestamp", () => {
    const before = Date.now();
    const response = createSuccessResponse(1);
    const after = Date.now();

    const ts = Date.parse(response.timestamp);

    expect(Number.isNaN(ts)).toBe(false);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});
