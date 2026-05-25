import { describe, expect, test } from "bun:test";
import { passwordService } from "../../../src/lib/password";

describe("password-utils", () => {
  test("passwordService.hash produces a bcrypt hash", async () => {
    const hash = await passwordService.hash("hunter2!");

    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(hash).not.toBe("hunter2!");
  });

  test("passwordService.hash is non-deterministic (salted)", async () => {
    const first = await passwordService.hash("hunter2!");
    const second = await passwordService.hash("hunter2!");

    expect(first).not.toBe(second);
  });

  test("passwordService.verify returns true for correct password", async () => {
    const hash = await passwordService.hash("hunter2!");

    expect(await passwordService.verify("hunter2!", hash)).toBe(true);
  });

  test("passwordService.verify returns false for wrong password", async () => {
    const hash = await passwordService.hash("hunter2!");

    expect(await passwordService.verify("hunter3!", hash)).toBe(false);
  });

  test("passwordService.verify returns false for malformed hash", async () => {
    expect(await passwordService.verify("anything", "not-a-bcrypt-hash")).toBe(
      false
    );
  });
});
