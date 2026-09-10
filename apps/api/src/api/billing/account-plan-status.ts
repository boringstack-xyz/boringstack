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
      return paidFeatures;
    case "canceled":
      if (currentPeriodEnd !== null && currentPeriodEnd.getTime() > nowMs) {
        return paidFeatures;
      }

      return freeFeatures;
    /*
     * Delinquency ends entitlement immediately, per the security-review
     * decision. There is no grace period at a higher layer, and nothing
     * sweeps these statuses — `account-maintenance` revokes `canceled`
     * only — so treating them as paid grants a failed card indefinite
     * access. A grace period, if wanted, belongs in an explicit expiry the
     * resolver can read, not in an unenforced assumption.
     */
    case "past_due":
    case "unpaid":
    case "paused":
    case "incomplete":
      return freeFeatures;
  }
};

const KNOWN_STATUSES: readonly string[] = [
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "paused",
  "canceled",
  "incomplete",
];

/*
 * `account_plans.status` is a varchar, so the database can hold a value this
 * union does not know — a Stripe status newer than this code, or a
 * hand-edited row. An unrecognised status must not entitle: failing open
 * there hands out paid features through the one path nobody considered.
 */
export const isKnownPlanStatus = (
  status: string
): status is AccountPlanStatus => KNOWN_STATUSES.includes(status);

/**
 * Whether a plan row entitles its account right now.
 *
 * `expiresAt` is the administrative-grant deadline — the entire point of a
 * time-boxed grant, and a lapsed one must stop paying out.
 */
export const isPlanEntitling = (
  status: string,
  currentPeriodEnd: Date | null,
  expiresAt: Date | null,
  nowMs: number
): boolean => {
  if (expiresAt !== null && expiresAt.getTime() <= nowMs) {
    return false;
  }

  if (!isKnownPlanStatus(status)) {
    return false;
  }

  return (
    selectEffectiveFeatures(
      status,
      PAID_SENTINEL,
      FREE_SENTINEL,
      currentPeriodEnd,
      nowMs
    ) === PAID_SENTINEL
  );
};

/*
 * Distinct empty arrays used purely as identity markers, so the predicate
 * above reuses the switch rather than restating it — two copies of a
 * status-to-entitlement mapping is exactly how they drift apart.
 */
const PAID_SENTINEL: readonly IPlanFeatureRow[] = [];
const FREE_SENTINEL: readonly IPlanFeatureRow[] = [];
