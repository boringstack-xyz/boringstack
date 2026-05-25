export const BILLING_QUERY_KEYS = {
  plans: ["billing", "plans"] as const,
  subscription: ["billing", "subscription"] as const
} as const;

export const BILLING_PATH = "/account/billing" as const;
