import { describe, expect, test } from "bun:test";
import {
  isValidEmail,
  maskEmailForLogging,
} from "../../../src/lib/email/email.utils";

describe("isValidEmail", () => {
  test.each([
    ["a@b.co", true],
    ["jane.doe+tag@example.co.uk", true],
    ["", false],
    ["   ", false],
    ["no-at-sign", false],
    ["@nope.com", false],
    ["nope@", false],
    ["spaces in@example.com", false],
  ])("isValidEmail(%p) -> %p", (input, expected) => {
    expect(isValidEmail(input)).toBe(expected);
  });
});

describe("maskEmailForLogging", () => {
  test("short local part → fully redacted local", () => {
    expect(maskEmailForLogging("a@example.com")).toBe("***@example.com");
    expect(maskEmailForLogging("ab@example.com")).toBe("***@example.com");
  });

  test("longer local part → first/last visible", () => {
    expect(maskEmailForLogging("jane@example.com")).toBe("j***e@example.com");
    expect(maskEmailForLogging("jane.doe@example.com")).toBe(
      "j***e@example.com"
    );
  });

  test("no @ → '***'", () => {
    expect(maskEmailForLogging("not-an-email")).toBe("***");
  });

  test("empty string → '***'", () => {
    expect(maskEmailForLogging("")).toBe("***");
  });
});
