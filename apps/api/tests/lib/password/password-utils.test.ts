import { describe, expect, test } from "bun:test";

import { passwordService } from "../../../src/lib/password";
import { ARGON2ID_PREFIX } from "../../../src/lib/password/password.constants";

describe("password-utils", () => {
  describe("hash", () => {
    test("produces argon2id-prefixed hashes for new passwords", async () => {
      const hash = await passwordService.hash("hunter2!");

      expect(hash.startsWith(ARGON2ID_PREFIX)).toBe(true);
      expect(hash).not.toBe("hunter2!");
    });

    test("is non-deterministic (salted)", async () => {
      const first = await passwordService.hash("hunter2!");
      const second = await passwordService.hash("hunter2!");

      expect(first).not.toBe(second);
    });
  });

  describe("verify", () => {
    test("verifies a freshly hashed argon2id password", async () => {
      const hash = await passwordService.hash("hunter2!");

      expect(await passwordService.verify("hunter2!", hash)).toBe(true);
    });

    test("rejects the wrong password against an argon2id hash", async () => {
      const hash = await passwordService.hash("hunter2!");

      expect(await passwordService.verify("hunter3!", hash)).toBe(false);
    });

    test("returns false for a malformed hash", async () => {
      expect(await passwordService.verify("anything", "not-a-real-hash")).toBe(
        false
      );
    });

    test("verifies a legacy bcrypt hash transparently", async () => {
      const legacyBcryptHash =
        "$2b$10$HWyg.W7Jfw76p2MOcJkg4.j1/7ybSuUOTl/C8ZoEaUYm7eshwDV7K";

      expect(await passwordService.verify("hunter2", legacyBcryptHash)).toBe(
        true
      );
      expect(await passwordService.verify("hunter3", legacyBcryptHash)).toBe(
        false
      );
    });
  });

  describe("needsRehash", () => {
    test("flags bcrypt hashes for upgrade", () => {
      expect(passwordService.needsRehash("$2a$12$abc")).toBe(true);
      expect(passwordService.needsRehash("$2b$12$abc")).toBe(true);
      expect(passwordService.needsRehash("$2y$12$abc")).toBe(true);
    });

    test("does not flag argon2id hashes", async () => {
      const hash = await passwordService.hash("anything");

      expect(passwordService.needsRehash(hash)).toBe(false);
    });

    test("flags any unknown hash format for upgrade", () => {
      expect(passwordService.needsRehash("$argon2i$v=19$...")).toBe(true);
      expect(passwordService.needsRehash("$argon2d$v=19$...")).toBe(true);
      expect(passwordService.needsRehash("plaintext")).toBe(true);
      expect(passwordService.needsRehash("")).toBe(true);
    });
  });

  describe("performDummyVerify", () => {
    test("completes without throwing", async () => {
      let threw = false;

      try {
        await passwordService.performDummyVerify();
      } catch {
        threw = true;
      }

      expect(threw).toBe(false);
    });
  });
});
