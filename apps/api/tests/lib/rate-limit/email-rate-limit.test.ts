import { describe, expect, test } from "bun:test";

import { emailRateLimiter } from "../../../src/lib/rate-limit/email-rate-limit";

const unique = (prefix: string): string =>
  `${prefix}-${String(Date.now())}-${String(Math.random()).slice(2)}@example.com`;

describe("emailRateLimiter.check", () => {
  test("allows the first three attempts within the window", () => {
    const email = unique("first-three");

    expect(emailRateLimiter.check(email)).toBe(true);
    expect(emailRateLimiter.check(email)).toBe(true);
    expect(emailRateLimiter.check(email)).toBe(true);
  });

  test("blocks the fourth attempt", () => {
    const email = unique("fourth-blocked");

    emailRateLimiter.check(email);
    emailRateLimiter.check(email);
    emailRateLimiter.check(email);

    expect(emailRateLimiter.check(email)).toBe(false);
  });

  test("treats trimming + casing as the same bucket", () => {
    const base = unique("normalize");

    emailRateLimiter.check(base);
    emailRateLimiter.check(`  ${base.toUpperCase()}  `);
    emailRateLimiter.check(base);

    expect(emailRateLimiter.check(base)).toBe(false);
  });

  test("isolates buckets across distinct emails", () => {
    const firstEmail = unique("isolate-a");
    const secondEmail = unique("isolate-b");

    emailRateLimiter.check(firstEmail);
    emailRateLimiter.check(firstEmail);
    emailRateLimiter.check(firstEmail);

    expect(emailRateLimiter.check(firstEmail)).toBe(false);
    expect(emailRateLimiter.check(secondEmail)).toBe(true);
  });
});

describe("emailRateLimiter.sweep", () => {
  test("is callable without throwing", () => {
    expect(() => {
      emailRateLimiter.sweep();
    }).not.toThrow();
  });
});
