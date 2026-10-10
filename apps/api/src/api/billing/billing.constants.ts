export const PLAN_NAME = {
  free: "Free",
  pro: "Pro",
} as const;

export const BILLING_INTERVALS = ["month", "year"] as const;

export const DEFAULT_BILLING_INTERVAL = "month" as const;

export const SUBSCRIPTION_CONFLICT_MESSAGE =
  "Manage your existing subscription from Billing";

/*
 * `incomplete_expired` is persisted as `canceled` (see STRIPE_STATUS_MAP), so
 * the local check only needs the one terminal status. Stripe's own statuses
 * are compared against both values.
 */
export const TERMINAL_SUBSCRIPTION_STATUSES = [
  "canceled",
  "incomplete_expired",
] as const;

export const CHECKOUT_SESSION_MODE = "subscription" as const;

export const CHECKOUT_SESSION_OPEN = "open" as const;

export const STRIPE_LIST_PAGE_SIZE = 100;
