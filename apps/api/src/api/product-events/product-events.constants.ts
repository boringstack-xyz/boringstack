/*
 * Example allowlist. Replace these with the moments your product measures;
 * the API rejects any kind not listed here, so nothing else reaches the table.
 */
export const PRODUCT_EVENT_KINDS = [
  "sign_up_completed",
  "checkout_started",
  "feedback_given",
] as const;

export const PRODUCT_EVENT_CONTEXT_PATTERN = "^[a-z0-9_]{0,40}$";

/* Rows older than this are deleted by the account-maintenance sweep. */
export const PRODUCT_EVENT_RETENTION_DAYS = 365;

/* Per-caller cap: fixed window. */
export const PRODUCT_EVENT_RATE_LIMIT = {
  max: 60,
  durationMs: 60_000,
} as const;
