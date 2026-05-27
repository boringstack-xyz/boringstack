import { jwt } from "@elysiajs/jwt";
import { env } from "../../config/env";
import { JWT_NAME, JWT_TTL, JWT_TTL_SECONDS } from "./jwt.constants";

export const createJWTConfig = () =>
  jwt({
    name: JWT_NAME,
    secret: env.JWT_SECRET,
    exp: JWT_TTL,
  });

/**
 * Build the payload signed into the auth JWT. The shape is constrained to
 * `Record<string, string | number>` so it satisfies `@elysiajs/jwt`'s
 * indexed-claim signature without using `as`.
 *
 * `jti` is a fresh UUID per token so the auth plugin can blocklist a
 * specific session on logout. `iat` is the JWT-standard issued-at
 * timestamp; the auth plugin compares it to a per-user "revoked-before"
 * marker so password change / reset can invalidate every previously
 * issued token without enumerating their JTIs.
 */
export const buildJWTPayload = (
  id: string,
  email: string,
  accountId: string
): Record<string, string | number> => {
  const nowSeconds = Math.floor(Date.now() / 1000);

  return {
    id,
    email,
    aid: accountId,
    jti: crypto.randomUUID(),
    iat: nowSeconds,
    exp: nowSeconds + JWT_TTL_SECONDS,
  };
};
