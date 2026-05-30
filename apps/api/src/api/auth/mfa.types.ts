/**
 * Internal payloads passed between `mfaService` and its callers
 * (`mfa.routes.ts`, `auth.service.ts`). TypeBox HTTP shapes live in
 * `mfa.schemas.ts`; keep the two definitions separate so the service
 * never depends on Elysia.
 */

import type { IPublicUser } from "./auth.types";

export interface IMfaSetupResult {
  /** otpauth:// URI for QR-code rendering in the SPA. */
  otpauthUri: string;
  /** Base32-encoded secret. Shown alongside the QR as a fallback. */
  secretBase32: string;
  /** Plaintext recovery codes. Returned exactly once. */
  recoveryCodes: string[];
}

export interface IMfaVerifyOk {
  kind: "verified";
  user: IPublicUser;
}

export interface IMfaVerifyFailed {
  kind: "failed";
  attemptsRemaining: number;
}

export interface IMfaVerifyLockedOut {
  kind: "locked_out";
}

/**
 * Outcome of `/auth/mfa/verify-login` and `/auth/mfa/verify-recovery`
 * at the service layer. The route turns this into a 200 + cookies on
 * `verified`, a 401 on `failed`, or a 401 with a distinct error code
 * on `locked_out`. Modeled as a discriminated union so the route never
 * leaks a Valkey state shape into its response.
 */
export type IMfaVerifyOutcome =
  | IMfaVerifyOk
  | IMfaVerifyFailed
  | IMfaVerifyLockedOut;

export interface IMfaChallenge {
  /** Opaque token returned to the SPA. Hex-encoded. */
  challengeToken: string;
}

export interface IMfaRecoveryRegenerationResult {
  recoveryCodes: string[];
}

/**
 * Shape of the value persisted in Valkey under
 * `MFA_CACHE_KEYS.setup(userId)`. The secret is already encrypted at
 * this point — Valkey never sees the plaintext TOTP secret.
 */
export interface IMfaSetupCachePayload {
  secretEncrypted: string;
  recoveryCodeHashes: string[];
}

/**
 * Shape of the value persisted in Valkey under
 * `MFA_CACHE_KEYS.challenge(tokenHash)`.
 */
export interface IMfaChallengeCachePayload {
  userId: string;
  attempts: number;
}
