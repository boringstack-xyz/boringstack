/*
 * Example allowlist, mirroring the API's product event kinds. Only these names
 * ever reach GA4; replace them with the moments your product measures.
 */
export const ANALYTICS_EVENTS = [
  "sign_up_completed",
  "checkout_started",
  "feedback_given"
] as const;

/** The only parameters an event may carry: categories, never identities. */
export const ANALYTICS_PARAM_KEYS = ["method", "reason", "step"] as const;

/** Parameter values are short lowercase tokens, so an id or email cannot ride along. */
export const ANALYTICS_PARAM_VALUE_PATTERN = /^[a-z0-9_-]{1,40}$/u;

/** GA's own cookies, cleared when the visitor withdraws analytics consent. */
export const GA_COOKIE_PATTERN = /^_ga(?:_|$)/u;
