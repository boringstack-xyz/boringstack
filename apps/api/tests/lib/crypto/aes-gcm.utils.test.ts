import { describe, expect, test } from "bun:test";

import {
  constantTimeEqual,
  decryptString,
  encryptString,
} from "../../../src/lib/crypto";

describe("encryptString / decryptString", () => {
  test("roundtrips a plaintext through versioned ciphertext", () => {
    const plaintext = "JBSWY3DPEHPK3PXP";
    const ciphertext = encryptString(plaintext);

    expect(ciphertext.startsWith("v1$")).toBe(true);
    expect(ciphertext.split("$")).toHaveLength(4);
    expect(decryptString(ciphertext)).toBe(plaintext);
  });

  test("emits a fresh IV per call — same plaintext encrypts to different ciphertexts", () => {
    const a = encryptString("repeat");
    const b = encryptString("repeat");

    expect(a).not.toBe(b);
    expect(decryptString(a)).toBe("repeat");
    expect(decryptString(b)).toBe("repeat");
  });

  test("rejects a tampered ciphertext", () => {
    const ciphertext = encryptString("secret");
    const [version, iv, body, tag] = ciphertext.split("$");
    const flippedBody =
      body !== undefined && body.length > 0
        ? `${body.slice(0, -1)}${body.endsWith("A") ? "B" : "A"}`
        : "AAAA";
    const tampered = [version, iv, flippedBody, tag].join("$");

    expect(() => decryptString(tampered)).toThrow();
  });

  test("rejects an unknown ciphertext version", () => {
    const ciphertext = encryptString("secret");
    const parts = ciphertext.split("$");

    parts[0] = "v9";

    expect(() => decryptString(parts.join("$"))).toThrow(
      /Unsupported ciphertext version/
    );
  });

  test("rejects a malformed payload (wrong segment count)", () => {
    expect(() => decryptString("v1$onlytwoparts")).toThrow(
      /Encrypted payload is malformed/
    );
  });
});

describe("constantTimeEqual", () => {
  test("returns true for identical strings", () => {
    expect(constantTimeEqual("alpha", "alpha")).toBe(true);
  });

  test("returns false for different content of equal length", () => {
    expect(constantTimeEqual("alpha", "beta!")).toBe(false);
  });

  test("returns false on length mismatch instead of throwing", () => {
    expect(constantTimeEqual("short", "longerstring")).toBe(false);
  });
});
