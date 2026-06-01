import { describe, expect, test } from "bun:test";

import { PUBLIC_EMAIL_DOMAINS } from "../../../src/lib/email-domain/public-domains";

describe("PUBLIC_EMAIL_DOMAINS", () => {
  test("includes the major consumer providers", () => {
    expect(PUBLIC_EMAIL_DOMAINS.has("gmail.com")).toBe(true);
    expect(PUBLIC_EMAIL_DOMAINS.has("outlook.com")).toBe(true);
    expect(PUBLIC_EMAIL_DOMAINS.has("yahoo.com")).toBe(true);
    expect(PUBLIC_EMAIL_DOMAINS.has("icloud.com")).toBe(true);
    expect(PUBLIC_EMAIL_DOMAINS.has("protonmail.com")).toBe(true);
  });

  test("includes burner / disposable services that should never claim a tenant", () => {
    expect(PUBLIC_EMAIL_DOMAINS.has("mailinator.com")).toBe(true);
    expect(PUBLIC_EMAIL_DOMAINS.has("10minutemail.com")).toBe(true);
    expect(PUBLIC_EMAIL_DOMAINS.has("guerrillamail.com")).toBe(true);
  });

  test("does not include corporate domains", () => {
    expect(PUBLIC_EMAIL_DOMAINS.has("anthropic.com")).toBe(false);
    expect(PUBLIC_EMAIL_DOMAINS.has("example.com")).toBe(false);
    expect(PUBLIC_EMAIL_DOMAINS.has("dreamdata.io")).toBe(false);
  });

  test("all entries are lowercased", () => {
    for (const domain of PUBLIC_EMAIL_DOMAINS) {
      expect(domain).toBe(domain.toLowerCase());
    }
  });

  test("contains a meaningful sample size (catches accidental truncation)", () => {
    expect(PUBLIC_EMAIL_DOMAINS.size).toBeGreaterThan(30);
  });
});
