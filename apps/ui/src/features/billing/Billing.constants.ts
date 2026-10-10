export const BILLING_QUERY_KEYS = {
  plans: ["billing", "plans"] as const,
  subscription: ["billing", "subscription"] as const
} as const;

export const BILLING_PATH = "/account/billing" as const;

/*
 * After Stripe returns the browser with `?checkout=success`, the plan change
 * arrives by webhook and can lag. Poll the subscription until it reports a
 * paid plan, or give up after the timeout and offer a manual re-check.
 */
export const CHECKOUT_POLL_INTERVAL_MS = 2_000;
export const CHECKOUT_POLL_TIMEOUT_MS = 30_000;
