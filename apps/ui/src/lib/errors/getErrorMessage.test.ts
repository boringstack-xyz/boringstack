import { describe, expect, it } from "vitest";

import { getErrorMessage } from "./getErrorMessage";

describe("getErrorMessage", () => {
  it("returns the message of an Error", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("threads the cause chain when present", () => {
    const cause = new Error("upstream timed out");
    const error = new Error("download failed", { cause });

    expect(getErrorMessage(error)).toBe(
      "download failed (cause: upstream timed out)"
    );
  });

  it("returns the string as-is when given a string", () => {
    expect(getErrorMessage("kaboom")).toBe("kaboom");
  });

  it("JSON-stringifies plain objects", () => {
    expect(getErrorMessage({ code: 42, message: "oops" })).toBe(
      JSON.stringify({ code: 42, message: "oops" })
    );
  });

  it("falls back to 'Unknown error' for circular refs", () => {
    const circular: Record<string, unknown> = {};

    circular.self = circular;
    expect(getErrorMessage(circular)).toBe("Unknown error");
  });

  it("handles null and undefined safely", () => {
    expect(getErrorMessage(null)).toBe("null");
    expect(getErrorMessage(undefined)).toBe(undefined as unknown as string);
  });
});
