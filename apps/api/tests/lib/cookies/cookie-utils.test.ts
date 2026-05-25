import { describe, expect, test } from "bun:test";

import {
  AUTH_COOKIE_CONFIG,
  AUTH_COOKIE_NAME,
  REFRESH_COOKIE_CONFIG,
  REFRESH_COOKIE_NAME,
} from "../../../src/lib/cookies/cookie-utils";

describe("cookie names", () => {
  test("exports a stable auth cookie name", () => {
    expect(AUTH_COOKIE_NAME).toBe("auth_token");
  });

  test("exports a stable refresh cookie name", () => {
    expect(REFRESH_COOKIE_NAME).toBe("refresh_token");
  });
});

describe("AUTH_COOKIE_CONFIG", () => {
  test("is HttpOnly and root-scoped", () => {
    expect(AUTH_COOKIE_CONFIG.httpOnly).toBe(true);
    expect(AUTH_COOKIE_CONFIG.path).toBe("/");
  });

  test("declares a positive maxAge (JWT TTL)", () => {
    expect(AUTH_COOKIE_CONFIG.maxAge).toBeGreaterThan(0);
  });

  test("sameSite is one of the safe lax/strict values", () => {
    expect(["lax", "strict"]).toContain(AUTH_COOKIE_CONFIG.sameSite);
  });
});

describe("REFRESH_COOKIE_CONFIG", () => {
  test("is HttpOnly and root-scoped", () => {
    expect(REFRESH_COOKIE_CONFIG.httpOnly).toBe(true);
    expect(REFRESH_COOKIE_CONFIG.path).toBe("/");
  });

  test("declares a 30-day maxAge", () => {
    const thirtyDaysInSeconds = 30 * 24 * 60 * 60;

    expect(REFRESH_COOKIE_CONFIG.maxAge).toBe(thirtyDaysInSeconds);
  });

  test("refresh cookie outlives the auth cookie", () => {
    expect(REFRESH_COOKIE_CONFIG.maxAge).toBeGreaterThan(
      AUTH_COOKIE_CONFIG.maxAge
    );
  });
});
