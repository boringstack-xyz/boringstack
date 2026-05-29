import { jwt } from "@elysiajs/jwt";
import { env } from "../../config/env";
import { JWT_NAME, JWT_TTL, JWT_TTL_SECONDS } from "./jwt.constants";
import { jwtRevocationService } from "./jwt-revocation";

export const createJWTConfig = () =>
  jwt({
    name: JWT_NAME,
    secret: env.JWT_SECRET,
    exp: JWT_TTL,
  });

/**
 * Build the payload signed into the auth JWT.
 *
 * `jti` is a fresh UUID per token so the auth plugin can blocklist a
 * specific session on logout. `iat` is the JWT-standard issued-at
 * timestamp; the auth plugin compares it to a per-user "revoked-before"
 * cutoff so password change / reset can invalidate every previously
 * issued token without enumerating their JTIs.
 *
 * The `iat` is lifted to `max(now, cutoff)` so a fresh token issued in
 * the same wall-clock second as a recent revoke isn't killed by the
 * cutoff it had no chance to be born before. JWTs are seconds-precision
 * and the revoke cutoff is `floor(now) + 1`; without this lift, every
 * login completing inside that one-second window would 401 on its first
 * authenticated request. The slight forward shift in `iat` stays well
 * inside the JWT clock-skew tolerance every verifier accepts.
 */
export const buildJWTPayload = async (
  id: string,
  email: string,
  accountId: string
): Promise<Record<string, string | number>> => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const cutoffSeconds = await jwtRevocationService.getUserRevokeCutoff(id);
  const iat = Math.max(nowSeconds, cutoffSeconds);

  return {
    id,
    email,
    aid: accountId,
    jti: crypto.randomUUID(),
    iat,
    exp: iat + JWT_TTL_SECONDS,
  };
};
