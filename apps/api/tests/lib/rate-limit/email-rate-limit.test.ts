import { describe, expect, test } from "bun:test";

import { emailRateLimiter } from "../../../src/lib/rate-limit/email-rate-limit";

const unique = (prefix: string): string =>
  `${prefix}-${String(Date.now())}-${String(Math.random()).slice(2)}@example.com`;

describe("emailRateLimiter.check", () => {
  test("allows the first three attempts within the window", async () => {
    const email = unique("first-three");

    expect(await emailRateLimiter.check(email)).toBe(true);
    expect(await emailRateLimiter.check(email)).toBe(true);
    expect(await emailRateLimiter.check(email)).toBe(true);
  });

  test("blocks the fourth attempt", async () => {
    const email = unique("fourth-blocked");

    await emailRateLimiter.check(email);
    await emailRateLimiter.check(email);
    await emailRateLimiter.check(email);

    expect(await emailRateLimiter.check(email)).toBe(false);
  });

  test("treats trimming + casing as the same bucket", async () => {
    const base = unique("normalize");

    await emailRateLimiter.check(base);
    await emailRateLimiter.check(`  ${base.toUpperCase()}  `);
    await emailRateLimiter.check(base);

    expect(await emailRateLimiter.check(base)).toBe(false);
  });

  test("isolates buckets across distinct emails", async () => {
    const firstEmail = unique("isolate-a");
    const secondEmail = unique("isolate-b");

    await emailRateLimiter.check(firstEmail);
    await emailRateLimiter.check(firstEmail);
    await emailRateLimiter.check(firstEmail);

    expect(await emailRateLimiter.check(firstEmail)).toBe(false);
    expect(await emailRateLimiter.check(secondEmail)).toBe(true);
  });
});

describe("emailRateLimiter.sweep", () => {
  test("is callable without throwing", () => {
    expect(() => {
      emailRateLimiter.sweep();
    }).not.toThrow();
  });
});
