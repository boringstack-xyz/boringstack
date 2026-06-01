import { env } from "../../config/env";
import { JWT_TTL_SECONDS } from "../jwt";

export const AUTH_COOKIE_NAME = "auth_token";
export const REFRESH_COOKIE_NAME = "refresh_token";

const REFRESH_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export const AUTH_COOKIE_CONFIG = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.isProduction ? ("strict" as const) : ("lax" as const),
  maxAge: JWT_TTL_SECONDS,
  path: "/",
};

export const REFRESH_COOKIE_CONFIG = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.isProduction ? ("strict" as const) : ("lax" as const),
  maxAge: REFRESH_COOKIE_MAX_AGE_SECONDS,
  path: "/",
};
