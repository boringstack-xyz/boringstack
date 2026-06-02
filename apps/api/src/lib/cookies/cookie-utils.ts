import { env } from "../../config/env";
import { JWT_TTL_SECONDS } from "../jwt";

export const AUTH_COOKIE_NAME = "auth_token";
export const REFRESH_COOKIE_NAME = "refresh_token";

const REFRESH_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/*
 * `secure` is always true: browsers treat http://localhost as a secure
 * context, so dev still works, while staging/preview hosts never ship auth
 * cookies over plaintext. `sameSite` stays env-conditional because dev OAuth
 * redirects cross ports and need `lax`.
 */
export const AUTH_COOKIE_CONFIG = {
  httpOnly: true,
  secure: true,
  sameSite: env.isProduction ? ("strict" as const) : ("lax" as const),
  maxAge: JWT_TTL_SECONDS,
  path: "/",
};

export const REFRESH_COOKIE_CONFIG = {
  httpOnly: true,
  secure: true,
  sameSite: env.isProduction ? ("strict" as const) : ("lax" as const),
  maxAge: REFRESH_COOKIE_MAX_AGE_SECONDS,
  path: "/",
};
