import { eq } from "drizzle-orm";
import { Elysia } from "elysia";

import { db } from "../../clients/postgres";
import { users } from "../../clients/postgres/schema";
import { AUTH_COOKIE_NAME } from "../../lib/cookies";
import { ApiError, ApiErrors } from "../../lib/errors";
import { createJWTConfig, parseAuthJWTPayload } from "../../lib/jwt";
import type { IUser } from "../users/users.types";

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

          const user = await db.query.users.findFirst({
            where: eq(users.id, parsed.userId),
          });

          if (!user) {
            throw ApiErrors.unauthorized("User not found");
          }

          return { user, accountId: parsed.accountId };
        } catch (err: unknown) {
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
        }
      }
    );
