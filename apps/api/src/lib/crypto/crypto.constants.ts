/**
 * Length of an AES-256 key in bytes. The cipher name is informational —
 * the value is fixed by the algorithm and lives here as a single source
 * of truth so the validator and the cipher both agree.
 */
export const AES_256_KEY_BYTES = 32;

/**
 * GCM mode runs with a 96-bit IV (NIST SP 800-38D recommendation).
 * Twelve random bytes per encrypt, never reused with the same key.
 */
export const AES_GCM_IV_BYTES = 12;

/**
 * GCM authentication tag length. Fixed at 16 bytes (128 bits) — the
 * maximum the algorithm provides — for the strongest forgery resistance.
 */
export const AES_GCM_TAG_BYTES = 16;

/**
 * Ciphertext format version prefix. Lets us migrate keys later without
 * touching the column type: every stored value starts with `v1$`, and a
 * future `v2$` (e.g. envelope-encrypted) decrypter dispatches on this.
 */
export const CIPHERTEXT_VERSION = "v1" as const;
