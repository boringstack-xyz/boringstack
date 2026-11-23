/**
 * The verification robot signs up in production on every release and on a
 * schedule (docs/operations/production-verification.md). Its accounts live
 * under one reserved domain. `.invalid` can never receive mail (RFC 2606), so
 * a person who types this domain into the sign-up form gets nowhere: the
 * verification link is never delivered, and only a caller holding
 * SYNTHETIC_CHECK_SECRET can verify the address another way.
 */
export const SYNTHETIC_EMAIL_DOMAIN = "robot.boringstack.invalid";

/** Header carrying SYNTHETIC_CHECK_SECRET on the robot-only routes. */
export const SYNTHETIC_SECRET_HEADER = "x-synthetic-secret";

/** Shortest secret the API accepts: 32 characters of `openssl rand -hex 32` is 128 bits. */
export const SYNTHETIC_SECRET_MIN_LENGTH = 32;

/** A robot account still present after this long was left by a run that died. */
export const SYNTHETIC_ACCOUNT_MAX_AGE_MS = 86_400_000;

/** `account_plans.source` for the robot's own Pro plan: never Stripe, never an operator's grant. */
export const SYNTHETIC_PLAN_SOURCE = "synthetic";
