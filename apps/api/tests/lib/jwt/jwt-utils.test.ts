import { describe, expect, test } from "bun:test";

import {
  buildJWTPayload,
  createJWTConfig,
} from "../../../src/lib/jwt/jwt-utils";
import { JWT_TTL_SECONDS } from "../../../src/lib/jwt/jwt.constants";

const TEST_EMAIL = "user@example.com";

describe("buildJWTPayload", () => {
  test("packs id, email, and account id under their canonical claim names", () => {
    const payload = buildJWTPayload("user-1", TEST_EMAIL, "acc-1");

    expect(payload.id).toBe("user-1");
    expect(payload.email).toBe(TEST_EMAIL);
    expect(payload.aid).toBe("acc-1");
  });

  test("sets exp to roughly now + JWT_TTL_SECONDS (seconds, not ms)", () => {
    const before = Math.floor(Date.now() / 1000);
    const payload = buildJWTPayload("user-1", TEST_EMAIL, "acc-1");
    const after = Math.floor(Date.now() / 1000);

    const exp = payload.exp;

    if (typeof exp !== "number") {
      throw new Error("exp must be numeric");
    }

    expect(exp).toBeGreaterThanOrEqual(before + JWT_TTL_SECONDS);
    expect(exp).toBeLessThanOrEqual(after + JWT_TTL_SECONDS);
  });

  test("returns only string|number values (compatible with @elysiajs/jwt)", () => {
    const payload = buildJWTPayload("user-1", TEST_EMAIL, "acc-1");

    for (const value of Object.values(payload)) {
      const token = typeof value;

      expect(token === "string" || token === "number").toBe(true);
    }
  });

  test("exp is an integer number of seconds since epoch", () => {
    const before = Math.floor(Date.now() / 1000);
    const payload = buildJWTPayload("user-1", TEST_EMAIL, "acc-1");
    const after = Math.floor(Date.now() / 1000);

    expect(Number.isInteger(payload.exp)).toBe(true);
    expect(payload.exp).toBeGreaterThanOrEqual(before + JWT_TTL_SECONDS);
    expect(payload.exp).toBeLessThanOrEqual(after + JWT_TTL_SECONDS);
  });
});

describe("createJWTConfig", () => {
  test("returns an Elysia plugin object", () => {
    const plugin = createJWTConfig();

    expect(plugin).toBeDefined();
    expect(typeof plugin).toBe("object");
  });
});
