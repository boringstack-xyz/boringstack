/**
 * TOTP step (RFC 6238). 30 seconds is the de facto standard every
 * authenticator app expects.
 */
export const MFA_TOTP_STEP_SECONDS = 30;

/**
 * Number of TOTP digits displayed by authenticator apps. Six is the RFC
 * default and what Google Authenticator / 1Password / Authy emit.
 */
export const MFA_TOTP_DIGITS = 6;

/**
 * Validation window in steps. `1` means "accept the previous, current,
 * and next step" — three 30-second windows total. Tight enough to keep
 * the attack surface small, lenient enough to absorb realistic client
 * clock drift.
 */
export const MFA_TOTP_WINDOW = 1;

/**
 * How long a staged secret stays in Valkey after `setup()` before the
 * row is dropped. Ten minutes is long enough to copy a secret into a
 * second device, short enough that abandoned enrollments self-clean.
 */
export const MFA_SETUP_TTL_SECONDS = 10 * 60;

/**
 * How long an opaque challenge token (returned by `/auth/login` when
 * the user has MFA enabled) is valid before the user must restart
 * with email + password.
 */
export const MFA_CHALLENGE_TTL_SECONDS = 5 * 60;

/**
 * Failed verify attempts allowed per challenge before the token is
 * destroyed. The user is forced back to `/auth/login`; the password
 * still works (we are not locking the account itself).
 */
export const MFA_MAX_CHALLENGE_ATTEMPTS = 5;

/**
 * Number of recovery codes generated at enrollment. Matches the count
 * used by GitHub, Discord, 1Password.
 */
export const MFA_RECOVERY_CODE_COUNT = 10;

/**
 * Bytes of entropy per recovery code before hex encoding. Five raw bytes
 * → ten hex chars, e.g. `8f3b2c91ae`. Plenty of entropy (40 bits) for a
 * code that is single-use, argon2id-hashed, and only handed out to the
 * user once.
 */
export const MFA_RECOVERY_CODE_BYTES = 5;

/**
 * TOTP issuer label embedded in the otpauth:// URI. Visible to the user
 * inside their authenticator app, so it should match the product name.
 * Pulled from APP_NAME at issuance — this constant is the fallback when
 * env is unavailable (tests).
 */
export const MFA_DEFAULT_ISSUER = "BoringStack";

/**
 * Cache key prefixes. Namespaced under `mfa:` per the cache-keys lint
 * rule (every cache key carries a feature-scoped prefix).
 */
export const MFA_CACHE_KEYS = {
  /** Staged enrollment secret + recovery code hashes. Keyed by userId. */
  setup: (userId: string): string => `mfa:setup:${userId}`,
  /**
   * Active TOTP challenge. Keyed by the HMAC hash of the opaque
   * challenge token — not the token itself, so a Valkey snapshot leak
   * cannot be replayed against the API.
   */
  challenge: (tokenHash: string): string => `mfa:challenge:${tokenHash}`,
} as const;

/**
 * Email template paths and subjects, mirroring the convention in
 * `auth.constants.ts`.
 */
export const MFA_TEMPLATE_PATHS = {
  ENABLED: "auth/mfa-enabled",
  DISABLED: "auth/mfa-disabled",
} as const;

export const MFA_EMAIL_SUBJECTS = {
  ENABLED: "Two-factor authentication is on",
  DISABLED: "Two-factor authentication is off",
} as const;
