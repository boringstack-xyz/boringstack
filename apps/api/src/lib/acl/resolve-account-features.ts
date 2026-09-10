import { and, eq, isNull } from "drizzle-orm";

import { db } from "../../clients/postgres";
import {
  accountFeatureOverrides,
  accountPlans,
  planFeatures,
} from "../../clients/postgres/schema";
import { isPlanEntitling } from "../../api/billing/account-plan-status";
import { filterToKnownFeatureKeys } from "../../api/users/users.acl-utils";
import { nowMs } from "../time/now";

import { resolveFeatures } from "./feature-resolution";
import type {
  IFeatureOverrideRow,
  IPlanFeatureRow,
  ResolvedFeatures,
} from "./feature-resolution.types";

const toDate = (value: string | null): Date | null =>
  value === null ? null : new Date(value);

/**
 * Resolves the effective feature map for an account from its current
 * plan row + active overrides. Shared by `/me` and route-level ACL.
 *
 * "Current" means unrevoked AND entitling. Selecting on `revokedAt IS NULL`
 * alone is not enough: an unpaid subscription, a lapsed administrative
 * grant and a canceled plan past its paid period would all resolve to paid
 * features. Nothing downstream covers that: `account-maintenance` sweeps
 * `canceled` only, so `status`, `currentPeriodEnd` and `expiresAt` are
 * consulted here, through the same `selectEffectiveFeatures` the billing
 * layer uses.
 */
export const resolveAccountFeatures = async (
  accountId: string
): Promise<ResolvedFeatures> => {
  const accountPlan = await db.query.accountPlans.findFirst({
    where: and(
      eq(accountPlans.accountId, accountId),
      isNull(accountPlans.revokedAt)
    ),
  });

  const entitling =
    accountPlan !== undefined &&
    isPlanEntitling(
      accountPlan.status,
      toDate(accountPlan.currentPeriodEnd),
      toDate(accountPlan.expiresAt),
      nowMs()
    );

  const [planFeatureRows, overrideRows] = await Promise.all([
    accountPlan === undefined || !entitling
      ? Promise.resolve([])
      : db
          .select()
          .from(planFeatures)
          .where(eq(planFeatures.planId, accountPlan.planId)),
    db
      .select()
      .from(accountFeatureOverrides)
      .where(eq(accountFeatureOverrides.accountId, accountId)),
  ]);

  const featurePlanRows: IPlanFeatureRow[] = filterToKnownFeatureKeys(
    planFeatureRows.map((row) => ({
      featureKey: row.featureKey,
      value: row.value,
    }))
  );

  const featureOverrideRows: IFeatureOverrideRow[] = filterToKnownFeatureKeys(
    overrideRows.map((row) => ({
      featureKey: row.featureKey,
      value: row.value,
      expiresAt: row.expiresAt === null ? null : new Date(row.expiresAt),
      revokedAt: row.revokedAt === null ? null : new Date(row.revokedAt),
    }))
  );

  return resolveFeatures(featurePlanRows, featureOverrideRows);
};
