import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { env } from "../../config/env";
import { ApiErrors } from "../errors";
import {
  AES_256_KEY_BYTES,
  AES_GCM_IV_BYTES,
  AES_GCM_TAG_BYTES,
  CIPHERTEXT_VERSION,
} from "./crypto.constants";

const CIPHER_ALGORITHM = "aes-256-gcm";

const decodeKey = (raw: string): Buffer => {
  if (raw === "") {
    throw ApiErrors.internal(
      "MFA_ENCRYPTION_KEY is empty. Generate one with `openssl rand -base64 32` and set it before enabling MFA."
    );
  }

  let key: Buffer;

  try {
    key = Buffer.from(raw, "base64");
  } catch {
    throw ApiErrors.internal(
      "MFA_ENCRYPTION_KEY is not valid base64. Generate a fresh key with `openssl rand -base64 32`."
    );
  }

  if (key.length !== AES_256_KEY_BYTES) {
    throw ApiErrors.internal(
      `MFA_ENCRYPTION_KEY decoded to ${String(key.length)} bytes; expected ${String(
        AES_256_KEY_BYTES
      )}. Regenerate with \`openssl rand -base64 32\`.`
    );
  }

  return key;
};

/**
 * AES-256-GCM string encryption with a versioned ciphertext format.
 *
 * Output: `v1$<iv_base64>$<ciphertext_base64>$<tag_base64>`
 *
 * The version prefix is the only thing future rotation strategies need
 * to discriminate on. Keys come from `env.MFA_ENCRYPTION_KEY` (32 bytes,
 * base64). The IV is fresh per call; never reuse a (key, iv) pair.
 */
export const encryptString = (plaintext: string): string => {
  const key = decodeKey(env.MFA_ENCRYPTION_KEY);
  const iv = randomBytes(AES_GCM_IV_BYTES);
  const cipher = createCipheriv(CIPHER_ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    CIPHERTEXT_VERSION,
    iv.toString("base64"),
    ciphertext.toString("base64"),
    tag.toString("base64"),
  ].join("$");
};

/**
 * Inverse of `encryptString`. Throws on any failure (bad version,
 * truncated payload, wrong key, tampered ciphertext) — every failure
 * mode is a configuration or attack signal, not a recoverable runtime
 * branch.
 */
export const decryptString = (payload: string): string => {
  const parts = payload.split("$");

  if (parts.length !== 4) {
    throw ApiErrors.internal("Encrypted payload is malformed");
  }

  const [version, ivB64, ciphertextB64, tagB64] = parts;

  if (version !== CIPHERTEXT_VERSION) {
    throw ApiErrors.internal(
      `Unsupported ciphertext version: ${version ?? "<empty>"}`
    );
  }

  if (
    ivB64 === undefined ||
    ciphertextB64 === undefined ||
    tagB64 === undefined
  ) {
    throw ApiErrors.internal("Encrypted payload is malformed");
  }

  const iv = Buffer.from(ivB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");
  const tag = Buffer.from(tagB64, "base64");

  if (iv.length !== AES_GCM_IV_BYTES || tag.length !== AES_GCM_TAG_BYTES) {
    throw ApiErrors.internal("Encrypted payload has wrong IV or tag length");
  }

  const key = decodeKey(env.MFA_ENCRYPTION_KEY);
  const decipher = createDecipheriv(CIPHER_ALGORITHM, key, iv);

  decipher.setAuthTag(tag);

  try {
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return plaintext.toString("utf8");
  } catch {
    throw ApiErrors.internal("Failed to decrypt payload");
  }
};

/**
 * Constant-time comparison for two same-length strings. Wraps
 * `crypto.timingSafeEqual` so callers don't repeat the length-guard
 * boilerplate. Returns false on length mismatch instead of throwing,
 * matching the typical "is this code valid?" usage shape.
 */
export const constantTimeEqual = (left: string, right: string): boolean => {
  const leftBuf = Buffer.from(left, "utf8");
  const rightBuf = Buffer.from(right, "utf8");

  if (leftBuf.length !== rightBuf.length) {
    return false;
  }

  return timingSafeEqual(leftBuf, rightBuf);
};
