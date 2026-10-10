import type { FEATURES } from "../../lib/acl/acl.constants";
import { FEATURE_KEYS } from "../../lib/acl/acl.constants";
import type { FeatureKey } from "../../lib/acl/acl.types";

import { BILLING_INTERVALS, PLAN_NAME } from "./billing.constants";
import type { BillingInterval } from "./billing.types";

/*
 * THE place to change what each built-in plan grants.
 *
 * Feature values are typed against the FEATURES catalog: a boolean feature
 * takes `{ bool }`, a limit takes `{ number }`. `PlanFeatureValues` requires
 * a key for every feature, so adding a key to FEATURES fails the type check
 * on Pro until a value is chosen for it. The unit test in
 * billing.plans.test.ts repeats that check at runtime.
 *
 * Free carries no rows on purpose: a missing feature resolves to its FEATURES
 * default, which is the free-tier behaviour.
 */
export const PRO_SEAT_LIMIT = 10;

type FeatureJson<K extends FeatureKey> =
  (typeof FEATURES)[K]["kind"] extends "boolean"
    ? { bool: boolean }
    : { number: number };

export type PlanFeatureValues = {
  readonly [K in FeatureKey]: FeatureJson<K>;
};

const FREE_FEATURES: Partial<PlanFeatureValues> = {};

const PRO_FEATURES = {
  can_export: { bool: true },
  can_invite_team: { bool: true },
  max_seats: { number: PRO_SEAT_LIMIT },
} satisfies PlanFeatureValues;

export interface IPlanPriceIds {
  readonly free: string;
  readonly proMonthly: string;
  readonly proYearly: string;
}

export interface IBuiltInPlan {
  readonly name: string;
  readonly isDefault: boolean;
  /** Empty string means the interval has no price configured. */
  readonly prices: Readonly<Record<BillingInterval, string>>;
  readonly features: Partial<PlanFeatureValues>;
}

export const buildBuiltInPlans = (
  priceIds: IPlanPriceIds
): readonly IBuiltInPlan[] => [
  {
    name: PLAN_NAME.free,
    isDefault: true,
    prices: { month: priceIds.free, year: "" },
    features: FREE_FEATURES,
  },
  {
    name: PLAN_NAME.pro,
    isDefault: false,
    prices: { month: priceIds.proMonthly, year: priceIds.proYearly },
    features: PRO_FEATURES,
  },
];

/** Feature keys a plan does not assign a value to. Empty for a complete plan. */
export const featureKeysWithoutValue = (plan: IBuiltInPlan): FeatureKey[] =>
  FEATURE_KEYS.filter((key) => plan.features[key] === undefined);

/**
 * Maps a Stripe price back to the built-in plan that sells it, for either
 * interval. Empty price ids never match, so an unconfigured interval cannot
 * claim a subscription that carries an empty price.
 */
export const findPlanNameByPriceId = (
  catalog: readonly IBuiltInPlan[],
  priceId: string
): string | undefined => {
  return priceId === ""
    ? undefined
    : catalog.find((plan) =>
        BILLING_INTERVALS.some((interval) => plan.prices[interval] === priceId)
      )?.name;
};
