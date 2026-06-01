import type { IPlanFeatureRow } from "../../lib/acl/feature-resolution.types";

import type { AccountPlanStatus } from "./billing.types";

/**
 * Status → feature-set selector. The webhook persists the raw Stripe
 * status; this helper resolves which feature set the account should
 * see right now based on:
 *
 *   - status (active/trialing/past_due/unpaid/paused/canceled/incomplete)
 *   - currentPeriodEnd (relevant for canceled)
 *   - nowMs (test-injectable)
 *
 * Returns the feature rows the resolver should treat as the
 * "effective plan" for the account. Pure: no DB, no Stripe.
 */
export const selectEffectiveFeatures = (
  status: AccountPlanStatus,
  paidFeatures: readonly IPlanFeatureRow[],
  freeFeatures: readonly IPlanFeatureRow[],
  currentPeriodEnd: Date | null,
  nowMs: number
): readonly IPlanFeatureRow[] => {
  switch (status) {
    case "active":
    case "trialing":
    case "past_due":
      return paidFeatures;
    case "canceled":
      if (currentPeriodEnd !== null && currentPeriodEnd.getTime() > nowMs) {
        return paidFeatures;
      }

      return freeFeatures;
    case "unpaid":
    case "paused":
    case "incomplete":
      return freeFeatures;
  }
};
