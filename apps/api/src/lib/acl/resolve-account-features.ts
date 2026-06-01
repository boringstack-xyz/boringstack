import { and, eq, isNull } from "drizzle-orm";

import { db } from "../../clients/postgres";
import {
  accountFeatureOverrides,
  accountPlans,
  planFeatures,
} from "../../clients/postgres/schema";
import { filterToKnownFeatureKeys } from "../../api/users/users.acl-utils";

import { resolveFeatures } from "./feature-resolution";
import type {
  IFeatureOverrideRow,
  IPlanFeatureRow,
  ResolvedFeatures,
} from "./feature-resolution.types";

/**
 * Resolves the effective feature map for an account from its current
 * plan row + active overrides. Shared by `/me` and route-level ACL.
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

  const [planFeatureRows, overrideRows] = await Promise.all([
    accountPlan === undefined
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
