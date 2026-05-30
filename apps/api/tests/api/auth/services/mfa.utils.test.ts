import { describe, expect, test } from "bun:test";
import { Secret, TOTP } from "otpauth";

import {
  MFA_RECOVERY_CODE_COUNT,
  MFA_TOTP_STEP_SECONDS,
} from "../../../../src/api/auth/mfa.constants";
import {
  buildTotp,
  currentTotpStep,
  generateRecoveryCodes,
} from "../../../../src/api/auth/services/mfa.utils";

describe("currentTotpStep", () => {
  test("matches floor(Date.now()/1000/step)", () => {
    const expected = Math.floor(Date.now() / 1000 / MFA_TOTP_STEP_SECONDS);

    expect(currentTotpStep()).toBe(expected);
  });
});

describe("buildTotp", () => {
  test("constructs a TOTP that round-trips against otpauth.Secret", () => {
    const secret = new Secret({ size: 20 });
    const totp = buildTotp(secret.base32, "alice@example.com");

    expect(totp).toBeInstanceOf(TOTP);
    expect(totp.toString()).toMatch(/^otpauth:\/\/totp\//u);

    const code = totp.generate();

    expect(totp.validate({ token: code, window: 0 })).toBe(0);
  });
});

describe("generateRecoveryCodes", () => {
  test("returns the configured number of unique 10-char hex codes", () => {
    const codes = generateRecoveryCodes();

    expect(codes).toHaveLength(MFA_RECOVERY_CODE_COUNT);

    for (const code of codes) {
      expect(code).toMatch(/^[0-9a-f]{10}$/u);
    }

    expect(new Set(codes).size).toBe(codes.length);
  });
});
