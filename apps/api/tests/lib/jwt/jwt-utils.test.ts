import { afterEach, describe, expect, spyOn, test } from "bun:test";

import { jwtRevocationService } from "../../../src/lib/jwt/jwt-revocation";
import {
  buildJWTPayload,
  createJWTConfig,
} from "../../../src/lib/jwt/jwt-utils";
import { JWT_TTL_SECONDS } from "../../../src/lib/jwt/jwt.constants";

const TEST_EMAIL = "user@example.com";

describe("buildJWTPayload", () => {
  afterEach(() => {
    /*
     * Restore the spy after every test. The default noop cache returns
     * 0 for getUserRevokeCutoff (no cutoff stored), which the tests
     * below either accept or override per-case.
     */
    spyOn(jwtRevocationService, "getUserRevokeCutoff").mockRestore();
  });

  test("packs id, email, and account id under their canonical claim names", async () => {
    const payload = await buildJWTPayload("user-1", TEST_EMAIL, "acc-1");

    expect(payload.id).toBe("user-1");
    expect(payload.email).toBe(TEST_EMAIL);
    expect(payload.aid).toBe("acc-1");
  });

  test("sets exp to roughly now + JWT_TTL_SECONDS (seconds, not ms)", async () => {
    const before = Math.floor(Date.now() / 1000);
    const payload = await buildJWTPayload("user-1", TEST_EMAIL, "acc-1");
    const after = Math.floor(Date.now() / 1000);

    const exp = payload.exp;

    if (typeof exp !== "number") {
      throw new Error("exp must be numeric");
    }

    expect(exp).toBeGreaterThanOrEqual(before + JWT_TTL_SECONDS);
    expect(exp).toBeLessThanOrEqual(after + JWT_TTL_SECONDS);
  });

  test("returns only string|number values (compatible with @elysiajs/jwt)", async () => {
    const payload = await buildJWTPayload("user-1", TEST_EMAIL, "acc-1");

    for (const value of Object.values(payload)) {
      const token = typeof value;

      expect(token === "string" || token === "number").toBe(true);
    }
  });

  test("exp is an integer number of seconds since epoch", async () => {
    const before = Math.floor(Date.now() / 1000);
    const payload = await buildJWTPayload("user-1", TEST_EMAIL, "acc-1");
    const after = Math.floor(Date.now() / 1000);

    expect(Number.isInteger(payload.exp)).toBe(true);
    expect(payload.exp).toBeGreaterThanOrEqual(before + JWT_TTL_SECONDS);
    expect(payload.exp).toBeLessThanOrEqual(after + JWT_TTL_SECONDS);
  });

  describe("iat is lifted past an active revoke cutoff", () => {
    test("with no cutoff (default noop cache), iat is current wall-clock seconds", async () => {
      const before = Math.floor(Date.now() / 1000);
      const payload = await buildJWTPayload("fresh-user", TEST_EMAIL, "acc-1");
      const after = Math.floor(Date.now() / 1000);

      expect(payload.iat).toBeGreaterThanOrEqual(before);
      expect(payload.iat).toBeLessThanOrEqual(after);
    });

    test("when a recent revoke set a future cutoff, iat lifts to cutoff + 1", async () => {
      /*
       * Simulate password-reset's revokeAllForUser: cutoff is
       * floor(now) + 1, killing every prior token. A login completing
       * in the same wall-clock second has nowSeconds == cutoff - 1, so
       * iat must lift to cutoff + 1 to survive the `iat < cutoff`
       * check with strict-greater-than headroom — equal-to-cutoff
       * passed by zero margin and intermittently lost the race on CI
       * when the cache read for /me happened to see a slightly later
       * cutoff value than buildJWTPayload's read.
       */
      const futureCutoff = Math.floor(Date.now() / 1000) + 1;

      spyOn(jwtRevocationService, "getUserRevokeCutoff").mockResolvedValue(
        futureCutoff
      );

      const payload = await buildJWTPayload(
        "user-with-cutoff",
        TEST_EMAIL,
        "acc-1"
      );

      expect(payload.iat).toBe(futureCutoff + 1);
      expect(payload.exp).toBe(futureCutoff + 1 + JWT_TTL_SECONDS);
    });

    test("when the cutoff is in the past, iat stays at wall-clock now", async () => {
      const staleCutoff = Math.floor(Date.now() / 1000) - 3600;

      spyOn(jwtRevocationService, "getUserRevokeCutoff").mockResolvedValue(
        staleCutoff
      );

      const before = Math.floor(Date.now() / 1000);
      const payload = await buildJWTPayload(
        "user-with-stale-cutoff",
        TEST_EMAIL,
        "acc-1"
      );
      const after = Math.floor(Date.now() / 1000);

      expect(payload.iat).toBeGreaterThanOrEqual(before);
      expect(payload.iat).toBeLessThanOrEqual(after);
    });
  });
});

describe("createJWTConfig", () => {
  test("returns an Elysia plugin object", () => {
    const plugin = createJWTConfig();

    expect(plugin).toBeDefined();
    expect(typeof plugin).toBe("object");
  });
});
