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

export const createAuthMiddleware = () =>
  new Elysia()
    .use(createJWTConfig())
    .derive(
      async ({
        jwt: jwtPlugin,
        cookie,
      }): Promise<{ user: IUser; accountId: string }> => {
        try {
          const authCookie = cookie[AUTH_COOKIE_NAME];

          if (authCookie?.value === undefined) {
            throw ApiErrors.unauthorized("Missing authentication cookie");
          }

          const cookieValue = authCookie.value;

          if (typeof cookieValue !== "string") {
            throw ApiErrors.unauthorized("Invalid authentication cookie");
          }

          const verified = await jwtPlugin.verify(cookieValue);
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

          return { user, accountId: parsed.accountId };
        } catch (err: unknown) {
          return translateJwtError(err);
        }
      }
    );
