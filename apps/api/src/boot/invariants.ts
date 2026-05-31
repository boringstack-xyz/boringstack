/**
 * Boot-time invariants — assertions that must hold by the time the
 * HTTP server starts listening.
 *
 * The env validator (src/config/env/validate.ts) enforces presence and
 * shape of every variable. This module enforces the narrower class of
 * "value is set, but won't actually work at runtime":
 *
 *   - MFA_ENCRYPTION_KEY decodes from base64 to exactly 32 bytes
 *     (AES-256). Caught here so a misconfigured deploy aborts at boot
 *     instead of throwing on the first MFA enroll/verify request.
 *
 * Future additions: DB schema-version probe, queue connectivity ping,
 * required-feature capability check. Add them as `assertX` functions
 * called from `assertBootInvariants`.
 */
import type { Env } from "../config/env/schema";
import { AES_256_KEY_BYTES } from "../lib/crypto/crypto.constants";

export class BootInvariantError extends Error {
  public readonly violations: readonly string[];

  public constructor(violations: readonly string[]) {
    super(`Boot invariants failed:\n  - ${violations.join("\n  - ")}`);
    this.name = "BootInvariantError";
    this.violations = violations;
  }
}

/**
 * Verify the MFA encryption key, if set, will actually drive AES-256-GCM.
 * Empty is allowed (the env validator already requires non-empty in
 * production, dev/test can opt out of MFA entirely).
 */
function checkMfaKeyDecodable(env: Env): string[] {
  if (env.MFA_ENCRYPTION_KEY === "") {
    return [];
  }

  let decoded: Buffer;

  try {
    decoded = Buffer.from(env.MFA_ENCRYPTION_KEY, "base64");
  } catch {
    return [
      "MFA_ENCRYPTION_KEY is not valid base64. Regenerate with `openssl rand -base64 32`.",
    ];
  }

  if (decoded.length !== AES_256_KEY_BYTES) {
    return [
      `MFA_ENCRYPTION_KEY decoded to ${String(decoded.length)} bytes; expected ${String(AES_256_KEY_BYTES)}. Regenerate with \`openssl rand -base64 32\`.`,
    ];
  }

  return [];
}

/**
 * Aggregate every boot invariant. Returns the list of violations
 * instead of throwing so callers can decide how to log/abort (the
 * primary caller is `assertBootInvariants` below, but tests prefer
 * to inspect the list).
 */
export function collectBootInvariantViolations(env: Env): string[] {
  return [...checkMfaKeyDecodable(env)];
}

/**
 * Throws `BootInvariantError` if any invariant fails. Call this from
 * `src/index.ts` BEFORE `createApp().listen()` so a misconfigured
 * deploy aborts at boot rather than surfacing as a 500 to the first
 * affected user.
 */
export function assertBootInvariants(env: Env): void {
  const violations = collectBootInvariantViolations(env);

  if (violations.length > 0) {
    throw new BootInvariantError(violations);
  }
}
