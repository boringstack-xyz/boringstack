/* Must match the API allowlist (apps/api/src/api/product-events/product-events.constants.ts). */
export const PRODUCT_EVENT_KINDS = [
  "sign_up_completed",
  "checkout_started",
  "feedback_given"
] as const;
