/** Valkey key prefix for the per-attempt state token. */
export const OAUTH_STATE_PREFIX = "oauth:state:";

/** TTL on a stored state — generous enough to survive a slow IdP redirect. */
export const OAUTH_STATE_TTL_SECONDS = 10 * 60;
