import { describe, expect, test } from "bun:test";
import { generateOpaqueToken } from "../../../src/lib/tokens";

describe("generateOpaqueToken", () => {
  test("default produces a 64-char hex string (32 bytes)", () => {
    const token = generateOpaqueToken();

    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[\da-f]+$/);
  });

  test("respects custom byte length", () => {
    expect(generateOpaqueToken(16)).toHaveLength(32);
  });

  test("two consecutive calls do not collide", () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();

    expect(a).not.toBe(b);
  });
});
