import { logger } from "../../config/logger";
import { cacheService } from "../cache";
import { getErrorMessage } from "../errors";
import { JWT_TTL_SECONDS } from "./jwt.constants";

const JTI_KEY_PREFIX = "jwt:revoked:";
const USER_KEY_PREFIX = "jwt:user:";
const USER_KEY_SUFFIX = ":revoked-before";

/*
 * "Revoked-before" entries outlive the longest-lived JWT they could
 * invalidate. JWT_TTL_SECONDS plus a healthy slack gives operators
 * room to bump TTL without race-condition surprises.
 */
const USER_REVOKE_TTL_SECONDS = JWT_TTL_SECONDS * 4;
const REVOKE_TTL_SLACK_SECONDS = 30;

const jtiKey = (jti: string): string => `${JTI_KEY_PREFIX}${jti}`;

const userRevokeKey = (userId: string): string =>
  `${USER_KEY_PREFIX}${userId}${USER_KEY_SUFFIX}`;

/**
 * Blocks a specific JWT by ID until it naturally expires. Idempotent —
 * repeat calls extend the TTL to the latest exp. Cache failures are
 * logged and swallowed: revocation is a security improvement, not a
 * correctness one, so a cache outage must not break logout.
 */
const revokeJti = async (jti: string, expSeconds: number): Promise<void> => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const ttlSeconds =
    Math.max(0, expSeconds - nowSeconds) + REVOKE_TTL_SLACK_SECONDS;

  try {
    await cacheService.set(jtiKey(jti), "1", { ttlSeconds });
  } catch (error: unknown) {
    logger.warn("Failed to revoke JWT jti", {
      event: "auth.jwt.revoke_failed",
      jti,
      error: getErrorMessage(error),
    });
  }
};

/**
 * Marks every previously issued token for `userId` as revoked. The next
 * authenticated request will compare the token's `iat` against the
 * stored cutoff and reject if it was issued before.
 *
 * Cutoff is "now plus one second" so tokens issued in the same wall-clock
 * second as the revocation still get killed (defense against a fast
 * attacker racing the call).
 */
const revokeAllForUser = async (userId: string): Promise<void> => {
  const cutoffSeconds = Math.floor(Date.now() / 1000) + 1;

  try {
    await cacheService.set(userRevokeKey(userId), cutoffSeconds, {
      ttlSeconds: USER_REVOKE_TTL_SECONDS,
    });
  } catch (error: unknown) {
    logger.warn("Failed to revoke all JWTs for user", {
      event: "auth.jwt.revoke_user_failed",
      userId,
      error: getErrorMessage(error),
    });
  }
};

/**
 * Whether the given JTI has been blocklisted. Falls back to "not
 * revoked" on cache errors — see module comment on fail-open intent.
 */
const isJtiRevoked = async (jti: string): Promise<boolean> => {
  try {
    return await cacheService.has(jtiKey(jti));
  } catch (error: unknown) {
    logger.warn("JWT revocation jti check failed (failing open)", {
      event: "auth.jwt.revoke_check_failed",
      jti,
      error: getErrorMessage(error),
    });

    return false;
  }
};

/**
 * Whether the token (identified by its `iat`) was issued before the
 * user's revoke-before cutoff. Falls back to "not revoked" on cache
 * errors.
 */
const isUserRevokedSince = async (
  userId: string,
  issuedAtSeconds: number
): Promise<boolean> => {
  try {
    const cutoff = await cacheService.get<number>(userRevokeKey(userId));

    if (cutoff === null) {
      return false;
    }

    return issuedAtSeconds < cutoff;
  } catch (error: unknown) {
    logger.warn("JWT revocation user check failed (failing open)", {
      event: "auth.jwt.revoke_user_check_failed",
      userId,
      error: getErrorMessage(error),
    });

    return false;
  }
};

export const jwtRevocationService = {
  revokeJti,
  revokeAllForUser,
  isJtiRevoked,
  isUserRevokedSince,
};
