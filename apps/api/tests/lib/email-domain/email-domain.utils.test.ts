import { describe, expect, test } from "bun:test";

import {
  extractDomain,
  isPublicEmailDomain,
} from "../../../src/lib/email-domain";

describe("extractDomain", () => {
  test("returns the lowercased domain for a well-formed address", () => {
    expect(extractDomain("alice@Example.COM")).toBe("example.com");
  });

  test("strips a single trailing dot (fully-qualified domain edge case)", () => {
    expect(extractDomain("alice@example.com.")).toBe("example.com");
  });

  test("returns null for inputs without exactly one @ separator", () => {
    expect(extractDomain("alice")).toBeNull();
    expect(extractDomain("alice@@example.com")).toBeNull();
    expect(extractDomain("@example.com")).toBeNull();
    expect(extractDomain("alice@")).toBeNull();
  });

  test("returns null for empty / whitespace-only input", () => {
    expect(extractDomain("")).toBeNull();
    expect(extractDomain("   ")).toBeNull();
  });
});

describe("isPublicEmailDomain", () => {
  test("flags well-known consumer providers", () => {
    expect(isPublicEmailDomain("gmail.com")).toBe(true);
    expect(isPublicEmailDomain("outlook.com")).toBe(true);
    expect(isPublicEmailDomain("proton.me")).toBe(true);
    expect(isPublicEmailDomain("yahoo.co.uk")).toBe(true);
  });

  test("comparison is case-insensitive", () => {
    expect(isPublicEmailDomain("GMail.com")).toBe(true);
  });

  test("returns false for any corporate / unknown domain", () => {
    expect(isPublicEmailDomain("microsoft.com")).toBe(false);
    expect(isPublicEmailDomain("acme.example")).toBe(false);
    expect(isPublicEmailDomain("dreamdata.io")).toBe(false);
  });
});
