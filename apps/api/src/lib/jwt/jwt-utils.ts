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
 * When a cutoff exists, `iat` is lifted to `cutoff + 1` — one second
 * past it — instead of equal to it. The previous `max(now, cutoff)`
 * lift sat the new token's iat *exactly on* the cutoff, so the
 * `iat < cutoff` check passed by a margin of zero. Under load (CI
 * Playwright + Sentry/OTel instrumentation adding span overhead),
 * the cache read inside `buildJWTPayload` would occasionally race
 * against the cache read inside the subsequent `/me` auth check and
 * see different cutoff values, killing a freshly-minted token.
 * Adding the `+1` buffer gives strict-greater-than headroom: every
 * cache read of the same cutoff value still passes the check, and
 * the token's iat is at most ~1 second in the future, well inside
 * the JWT clock-skew tolerance every verifier accepts.
 *
 * Security envelope is unchanged: tokens *issued before* a revoke
 * still die, because their iat is computed without the cutoff (it
 * didn't exist yet). Tokens issued after the revoke survive — the
 * intended behaviour.
 */
export const buildJWTPayload = async (
  id: string,
  email: string,
  accountId: string
): Promise<Record<string, string | number>> => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const cutoffSeconds = await jwtRevocationService.getUserRevokeCutoff(id);
  const iat =
    cutoffSeconds > 0 ? Math.max(nowSeconds, cutoffSeconds + 1) : nowSeconds;

  return {
    id,
    email,
    aid: accountId,
    jti: crypto.randomUUID(),
    iat,
    exp: iat + JWT_TTL_SECONDS,
  };
};
