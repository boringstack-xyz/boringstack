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
 */
export const buildJWTPayload = (
  id: string,
  email: string,
  accountId: string
): Record<string, string | number> => ({
  id,
  email,
  aid: accountId,
  exp: Math.floor(Date.now() / 1000) + JWT_TTL_SECONDS,
});
