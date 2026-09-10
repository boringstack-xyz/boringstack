import { env } from "../../config/env";
import { JWT_TTL_SECONDS } from "../jwt";

export const AUTH_COOKIE_NAME = "auth_token";
export const REFRESH_COOKIE_NAME = "refresh_token";

/**
 * Ties an OAuth authorization round-trip to the browser that started it.
 *
 * State alone proves nothing about who is presenting it: an attacker can
 * begin a flow for their own identity and hand the unused callback URL to a
 * victim, whose browser then completes it and is logged in as the attacker
 * (RFC 9700, authorization-response CSRF). PKCE does not help — the server
 * takes the verifier from the same state the attacker supplied.
 *
 * The state itself stays in Valkey. Only a random nonce lives here, and the
 * server holds its hash, so a stolen cookie is not a usable state and a
 * stolen state is not a usable session.
 */
export const OAUTH_BINDING_COOKIE_NAME = "oauth_binding";

/**
 * Carries an MFA challenge back to the SPA after an OAuth callback.
 *
 * The password route can return the challenge in its JSON body; the OAuth
 * callback is a browser redirect and has nowhere to put it. A query
 * parameter would leak the challenge into history, logs and the referrer,
 * so it rides in a short-lived httpOnly cookie instead.
 */
export const MFA_CHALLENGE_COOKIE_NAME = "mfa_challenge";

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

/*
 * `sameSite: "lax"` unconditionally, unlike the session cookies: the whole
 * point is that this cookie must survive the provider's top-level redirect
 * back to the callback, which `strict` would strip. Lifetime is one
 * authorization round-trip.
 */
export const OAUTH_BINDING_COOKIE_CONFIG = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  maxAge: 600,
  path: "/",
};

/*
 * httpOnly, like every other credential here. The SPA never reads the
 * challenge: it posts the factor and the server takes the challenge from
 * this cookie, so the value cannot be lifted by script or leak through a
 * URL. `lax` because the cookie is set during the provider's top-level
 * redirect back to the callback.
 */
export const MFA_CHALLENGE_COOKIE_CONFIG = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  maxAge: 300,
  path: "/",
};

export const REFRESH_COOKIE_CONFIG = {
  httpOnly: true,
  secure: true,
  sameSite: env.isProduction ? ("strict" as const) : ("lax" as const),
  maxAge: REFRESH_COOKIE_MAX_AGE_SECONDS,
  path: "/",
};
