import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  RETURN_TO_MAX_AGE_MS,
  RETURN_TO_STORAGE_KEY,
  clearReturnTo,
  peekReturnTo,
  sanitizeReturnTo,
  storeReturnTo,
  takeReturnTo
} from "./return-to";

describe("sanitizeReturnTo", () => {
  it.each([
    "/dashboard",
    "/account/billing?checkout=success",
    "/invitations/abc#section"
  ])("accepts the same-origin path %s", (value) => {
    expect(sanitizeReturnTo(value)).toBe(value);
  });

  it.each([
    ["absolute URL", "https://evil.example/steal"],
    ["protocol-relative", "//evil.example"],
    ["backslash after slash", "/\\evil.example"],
    ["tab-smuggled protocol-relative", "/\t/evil.example"],
    ["newline-smuggled", "/\n/evil.example"],
    ["relative without slash", "dashboard"],
    ["javascript scheme", "javascript:alert(1)"],
    ["backslash inside path", "/a\\b"],
    ["empty string", ""],
    ["non-string", 42],
    ["null", null],
    ["undefined", undefined]
  ])("rejects %s", (_label, value) => {
    expect(sanitizeReturnTo(value)).toBeNull();
  });
});

describe("return-to storage", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("stores a valid path and hands it back once via takeReturnTo", () => {
    storeReturnTo("/account/settings");

    expect(peekReturnTo()).toBe("/account/settings");
    expect(takeReturnTo()).toBe("/account/settings");
    expect(takeReturnTo()).toBeNull();
  });

  it("ignores an unsafe path instead of storing it", () => {
    storeReturnTo("//evil.example");

    expect(sessionStorage.getItem(RETURN_TO_STORAGE_KEY)).toBeNull();
    expect(peekReturnTo()).toBeNull();
  });

  it("drops a stored path that has expired", () => {
    const savedAt = 1_000_000;

    storeReturnTo("/account/settings", savedAt);

    expect(peekReturnTo(savedAt + RETURN_TO_MAX_AGE_MS)).toBe(
      "/account/settings"
    );
    expect(peekReturnTo(savedAt + RETURN_TO_MAX_AGE_MS + 1)).toBeNull();
  });

  it("rejects a tampered stored value that is not a safe path", () => {
    sessionStorage.setItem(
      RETURN_TO_STORAGE_KEY,
      JSON.stringify({ path: "//evil.example", savedAt: Date.now() })
    );

    expect(peekReturnTo()).toBeNull();
  });

  it("treats malformed JSON as nothing stored", () => {
    sessionStorage.setItem(RETURN_TO_STORAGE_KEY, "{not json");

    expect(peekReturnTo()).toBeNull();
  });

  it("clearReturnTo removes the stored path", () => {
    storeReturnTo("/dashboard");
    clearReturnTo();

    expect(peekReturnTo()).toBeNull();
  });
});
