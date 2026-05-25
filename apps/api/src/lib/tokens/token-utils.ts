import { createHmac, randomBytes } from "node:crypto";
import { env } from "../../config/env";
import { DEFAULT_OPAQUE_TOKEN_BYTES } from "./tokens.constants";

/**
 * Cryptographically random opaque token used for email-verification and
 * password-reset flows. Hex-encoded to keep it URL-safe without escaping.
 */
export const generateOpaqueToken = (
  bytes: number = DEFAULT_OPAQUE_TOKEN_BYTES
): string => randomBytes(bytes).toString("hex");

/**
 * Store only a keyed digest of opaque tokens. If the DB leaks, active
 * password-reset / verification / refresh tokens are not immediately usable.
 */
export const hashOpaqueToken = (token: string): string =>
  createHmac("sha256", env.JWT_SECRET).update(token).digest("hex");
