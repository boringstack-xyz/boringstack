import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";

import { cacheService } from "../../../src/lib/cache";
import { jwtRevocationService } from "../../../src/lib/jwt";

describe("jwtRevocationService", () => {
  beforeEach(async () => {
    await cacheService.del("jwt:revoked:test-jti");
    await cacheService.del("jwt:revoked:other-jti");
    await cacheService.del("jwt:user:test-user:revoked-before");
  });

  afterEach(async () => {
    await cacheService.del("jwt:revoked:test-jti");
    await cacheService.del("jwt:revoked:other-jti");
    await cacheService.del("jwt:user:test-user:revoked-before");
  });

  describe("revokeJti + isJtiRevoked", () => {
    test("a freshly revoked jti reads back as revoked", async () => {
      const exp = Math.floor(Date.now() / 1000) + 60;

      await jwtRevocationService.revokeJti("test-jti", exp);

      expect(await jwtRevocationService.isJtiRevoked("test-jti")).toBe(true);
    });

    test("an unknown jti is not revoked", async () => {
      expect(await jwtRevocationService.isJtiRevoked("other-jti")).toBe(false);
    });

    test("an already-expired exp still records (cache enforces TTL)", async () => {
      const expInPast = Math.floor(Date.now() / 1000) - 10;

      await jwtRevocationService.revokeJti("test-jti", expInPast);

      // slack window keeps the entry live briefly even for past exp
      expect(await jwtRevocationService.isJtiRevoked("test-jti")).toBe(true);
    });
  });

  describe("revokeAllForUser + isUserRevokedSince", () => {
    test("tokens issued before the cutoff are revoked", async () => {
      const oldIat = Math.floor(Date.now() / 1000) - 100;

      await jwtRevocationService.revokeAllForUser("test-user");

      expect(
        await jwtRevocationService.isUserRevokedSince("test-user", oldIat)
      ).toBe(true);
    });

    test("tokens issued after the cutoff are not revoked", async () => {
      await jwtRevocationService.revokeAllForUser("test-user");

      const futureIat = Math.floor(Date.now() / 1000) + 100;

      expect(
        await jwtRevocationService.isUserRevokedSince("test-user", futureIat)
      ).toBe(false);
    });

    test("a user without a cutoff entry is not revoked", async () => {
      const someIat = Math.floor(Date.now() / 1000) - 5;

      expect(
        await jwtRevocationService.isUserRevokedSince("test-user", someIat)
      ).toBe(false);
    });

    test("repeat revokeAllForUser updates the cutoff forward", async () => {
      await jwtRevocationService.revokeAllForUser("test-user");

      const between = Math.floor(Date.now() / 1000);

      // Sleep one whole second so the second revoke gets a strictly later cutoff.
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 1100);
      });

      await jwtRevocationService.revokeAllForUser("test-user");

      expect(
        await jwtRevocationService.isUserRevokedSince("test-user", between)
      ).toBe(true);
    });
  });

  describe("cache failure policy", () => {
    /*
     * Default policy is fail-open (JWT_REVOCATION_FAIL_CLOSED=false):
     * a cache outage must not turn into a global auth outage. The
     * fail-closed branch returns env.JWT_REVOCATION_FAIL_CLOSED
     * directly; its env wiring is covered by validate.test.ts (env is
     * frozen, so the flag cannot be flipped inside this process).
     */
    test("isJtiRevoked fails open when the cache check throws", async () => {
      const hasSpy = spyOn(cacheService, "has").mockRejectedValueOnce(
        new Error("cache down")
      );

      try {
        expect(await jwtRevocationService.isJtiRevoked("test-jti")).toBe(false);
      } finally {
        hasSpy.mockRestore();
      }
    });

    test("isUserRevokedSince fails open when the cache check throws", async () => {
      const getSpy = spyOn(cacheService, "get").mockRejectedValueOnce(
        new Error("cache down")
      );

      try {
        const iat = Math.floor(Date.now() / 1000) - 100;

        expect(
          await jwtRevocationService.isUserRevokedSince("test-user", iat)
        ).toBe(false);
      } finally {
        getSpy.mockRestore();
      }
    });
  });
});
