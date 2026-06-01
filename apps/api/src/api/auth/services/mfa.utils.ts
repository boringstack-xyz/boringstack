import { Secret, TOTP } from "otpauth";

import { env } from "../../../config/env";
import { nowMs } from "../../../lib/time/now";
import { generateOpaqueToken } from "../../../lib/tokens";
import {
  MFA_DEFAULT_ISSUER,
  MFA_RECOVERY_CODE_BYTES,
  MFA_RECOVERY_CODE_COUNT,
  MFA_TOTP_DIGITS,
  MFA_TOTP_STEP_SECONDS,
} from "../mfa.constants";

/**
 * Current TOTP step (count of `MFA_TOTP_STEP_SECONDS`-second intervals
 * since the epoch). Exposed as a helper so the service can persist the
 * matched step for replay-guard checks.
 */
export const currentTotpStep = (): number =>
  Math.floor(nowMs() / 1000 / MFA_TOTP_STEP_SECONDS);

/**
 * Build the otpauth `TOTP` instance the service uses to both render
 * the QR URI (during enrollment) and verify codes (during login). The
 * issuer label is the product name (`env.APP_NAME`), falling back to a
 * literal so tests with no env still produce a readable label.
 */
export const buildTotp = (secretBase32: string, label: string): TOTP =>
  new TOTP({
    issuer: env.APP_NAME === "" ? MFA_DEFAULT_ISSUER : env.APP_NAME,
    label,
    algorithm: "SHA1",
    digits: MFA_TOTP_DIGITS,
    period: MFA_TOTP_STEP_SECONDS,
    secret: Secret.fromBase32(secretBase32),
  });

/**
 * Generate a fresh batch of plaintext recovery codes. The caller is
 * responsible for hashing them before persistence; the plaintext only
 * leaves the API once, on the response to the enrolling client.
 */
export const generateRecoveryCodes = (): string[] => {
  const codes: string[] = [];

  for (let index = 0; index < MFA_RECOVERY_CODE_COUNT; index += 1) {
    codes.push(generateOpaqueToken(MFA_RECOVERY_CODE_BYTES));
  }

  return codes;
};
