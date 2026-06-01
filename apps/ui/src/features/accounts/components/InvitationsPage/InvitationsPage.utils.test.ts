import { describe, expect, it, vi } from "vitest";

import { formatExpiresAt, makeIdHandler } from "./InvitationsPage.utils";

describe("makeIdHandler", () => {
  it("returns a zero-arg handler bound to the supplied id", () => {
    const fn = vi.fn();
    const handler = makeIdHandler(fn)("inv-1");

    handler();

    expect(fn).toHaveBeenCalledWith("inv-1");
  });

  it("produces distinct handlers per id", () => {
    const fn = vi.fn();
    const factory = makeIdHandler(fn);

    factory("a")();
    factory("b")();

    expect(fn).toHaveBeenNthCalledWith(1, "a");
    expect(fn).toHaveBeenNthCalledWith(2, "b");
  });
});

describe("formatExpiresAt", () => {
  it("renders a valid ISO string as a locale date", () => {
    const formatted = formatExpiresAt("2026-06-01T12:00:00Z");

    expect(typeof formatted).toBe("string");
    expect(formatted.length).toBeGreaterThan(0);
  });

  it("does not throw on a malformed input (returns Invalid Date string)", () => {
    expect(() => formatExpiresAt("not-a-date")).not.toThrow();
  });
});
