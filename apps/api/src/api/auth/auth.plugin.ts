import * as Sentry from "@sentry/bun";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";

import { db } from "../../clients/postgres";
import { users } from "../../clients/postgres/schema";
import { AUTH_COOKIE_NAME } from "../../lib/cookies";
import { ApiError, ApiErrors } from "../../lib/errors";
import {
  createJWTConfig,
  jwtRevocationService,
  parseAuthJWTPayload,
} from "../../lib/jwt";
import type { IUser } from "../users/users.types";

/**
 * Two-tier revocation lookup. Runs after signature/expiry verification
 * so a forged token has to clear signing before the cache is even hit.
 * Tokens that predate the revocation feature lack `jti` / `issuedAt` —
 * they flow through unchecked and expire on their 15-minute clock.
 */
const assertJtiNotRevoked = async (jti: string | null): Promise<void> => {
  if (jti === null) {
    return;
  }

  const revoked = await jwtRevocationService.isJtiRevoked(jti);

  if (revoked) {
    throw ApiErrors.unauthorized("Token revoked");
  }
};

const assertUserNotRevokedSince = async (
  userId: string,
  issuedAt: number | null
): Promise<void> => {
  if (issuedAt === null) {
    return;
  }

  const revoked = await jwtRevocationService.isUserRevokedSince(
    userId,
    issuedAt
  );

  if (revoked) {
    throw ApiErrors.unauthorized("Token revoked");
  }
};

const assertNotRevoked = async (parsed: {
  userId: string;
  jti: string | null;
  issuedAt: number | null;
}): Promise<void> => {
  await assertJtiNotRevoked(parsed.jti);
  await assertUserNotRevokedSince(parsed.userId, parsed.issuedAt);
};

const translateJwtError = (err: unknown): never => {
  if (err instanceof ApiError) {
    throw err;
  }

  if (
    err !== null &&
    typeof err === "object" &&
    "name" in err &&
    typeof err.name === "string"
  ) {
    if (err.name === "TokenExpiredError") {
      throw ApiErrors.tokenExpired();
    }

    if (err.name === "JsonWebTokenError") {
      throw ApiErrors.unauthorized("Invalid token");
    }
  }

  throw ApiErrors.unauthorized("Authentication failed");
};

/**
 * Shared verify core for the two guards below. Encodes the contract that
 * `requireAuth` and `tryAuth` only differ on the missing-cookie case:
 *
 *  - missing cookie    → returns `null`
 *  - present + invalid → throws (translated `ApiError`)
 *  - present + valid   → returns the resolved session
 *
 * Anything that throws here is by definition a real authentication
 * failure (forged/expired/revoked credentials), and both guards surface
 * it as 401. Only the "no credentials presented at all" branch is what
 * the two guards interpret differently.
 */
const verifyAuthCookie = async (
  jwt: { verify: (token: string) => Promise<unknown> },
  cookieValue: unknown
): Promise<{ user: IUser; accountId: string } | null> => {
  if (cookieValue === undefined) {
    return null;
  }

  if (typeof cookieValue !== "string") {
    throw ApiErrors.unauthorized("Invalid authentication cookie");
  }

  try {
    const verified = await jwt.verify(cookieValue);
    const parsed = parseAuthJWTPayload(verified);

    if (parsed.kind !== "ok") {
      throw ApiErrors.unauthorized("Invalid token payload");
    }

    await assertNotRevoked(parsed);

    const user = await db.query.users.findFirst({
      where: eq(users.id, parsed.userId),
    });

    if (!user) {
      throw ApiErrors.unauthorized("User not found");
    }

    /*
     * Tag the active Sentry scope with the user so any error captured
     * for the rest of this request carries `user.id` + `user.email`.
     * The Pino mixin also reads this scope to inject `userId` on every
     * log record, so a Grafana log line and a GlitchTip error event can
     * be correlated by the same id. No-op when SENTRY_DSN is unset.
     */
    Sentry.setUser({ id: user.id, email: user.email });

    return { user, accountId: parsed.accountId };
  } catch (err: unknown) {
    return translateJwtError(err);
  }
};

/**
 * Required-auth guard. Use on every endpoint where an anonymous caller
 * is a programming error or a security boundary — mutations, account
 * management, billing, etc. The contract:
 *
 *  - missing cookie    → 401 `missing_session`
 *  - present + invalid → 401 `invalid_session`
 *  - present + valid   → handler runs with `user` + `accountId`
 *
 * For endpoints where "anonymous" is an expected, normal state (`/me`,
 * `/refresh`, `/mfa/status`), reach for `tryAuth` instead.
 */
export const requireAuth = () =>
  new Elysia()
    .use(createJWTConfig())
    .derive(
      async ({
        jwt: jwtPlugin,
        cookie,
      }): Promise<{ user: IUser; accountId: string }> => {
        const session = await verifyAuthCookie(
          jwtPlugin,
          cookie[AUTH_COOKIE_NAME]?.value
        );

        if (session === null) {
          throw ApiErrors.unauthorized("Missing authentication cookie");
        }

        return session;
      }
    );

/**
 * Best-effort auth guard. Resolves the session if one is presented and
 * valid; returns `{ user: null, accountId: null }` when no cookie is
 * presented at all. Still throws 401 when a cookie IS present but the
 * signature/payload doesn't verify — a forged or expired credential is
 * a real failure even on a probe endpoint, and the client should treat
 * it as a forced-logout signal rather than rendering as "anonymous".
 *
 * Use only on probe endpoints that a logged-out browser is expected to
 * hit on initial load. Every other authenticated route should use
 * `requireAuth`.
 */
export const tryAuth = () =>
  new Elysia()
    .use(createJWTConfig())
    .derive(
      async ({
        jwt: jwtPlugin,
        cookie,
      }): Promise<{ user: IUser | null; accountId: string | null }> => {
        const session = await verifyAuthCookie(
          jwtPlugin,
          cookie[AUTH_COOKIE_NAME]?.value
        );

        if (session === null) {
          return { user: null, accountId: null };
        }

        return session;
      }
    );
