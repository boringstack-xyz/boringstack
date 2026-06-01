import { and, eq, isNull } from "drizzle-orm";

import { db } from "../../clients/postgres";
import {
  accountFeatureOverrides,
  accountPlans,
} from "../../clients/postgres/schema";
import { AUDIT_ACTIONS, auditLogService } from "../../lib/audit-log";
import { ApiErrors } from "../../lib/errors";
import { now } from "../../lib/time/now";

import type {
  IGrantFeatureInput,
  IGrantPlanInput,
  IRevokeFeatureInput,
} from "./admin-billing.types";

export class AdminBillingService {
  /**
   * Grants a feature override on an account. Time-boundable via
   * `expiresAt`. Atomically revokes any prior active override for the
   * same `(account, feature_key)` first so the partial unique index
   * (`uniq_account_feature_overrides_active`) is never violated.
   */
  async grantFeature(input: IGrantFeatureInput): Promise<{ id: string }> {
    return db.transaction(async (tx) => {
      await tx
        .update(accountFeatureOverrides)
        .set({
          revokedAt: now(),
          revokedByUserId: input.grantedByUserId,
          revokedReason: "superseded_by_new_grant",
        })
        .where(
          and(
            eq(accountFeatureOverrides.accountId, input.accountId),
            eq(accountFeatureOverrides.featureKey, input.featureKey),
            isNull(accountFeatureOverrides.revokedAt)
          )
        );

      const [created] = await tx
        .insert(accountFeatureOverrides)
        .values({
          accountId: input.accountId,
          featureKey: input.featureKey,
          value: input.value,
          expiresAt: input.expiresAt,
          reason: input.reason,
          visibility: input.visibility,
          grantedByUserId: input.grantedByUserId,
          grantedByMembershipId: input.grantedByMembershipId,
        })
        .returning({ id: accountFeatureOverrides.id });

      if (!created) {
        throw ApiErrors.database("Failed to create feature override");
      }

      void auditLogService.record({
        userId: input.grantedByUserId,
        action: AUDIT_ACTIONS.FEATURE_OVERRIDE_GRANTED,
        resource: `override:${created.id}`,
        metadata: {
          accountId: input.accountId,
          featureKey: input.featureKey,
          expiresAt: input.expiresAt,
          visibility: input.visibility,
        },
      });

      return { id: created.id };
    });
  }

  async revokeFeature(input: IRevokeFeatureInput): Promise<void> {
    const [revoked] = await db
      .update(accountFeatureOverrides)
      .set({
        revokedAt: now(),
        revokedByUserId: input.revokedByUserId,
        revokedReason: input.reason,
      })
      .where(
        and(
          eq(accountFeatureOverrides.id, input.overrideId),
          isNull(accountFeatureOverrides.revokedAt)
        )
      )
      .returning({ id: accountFeatureOverrides.id });

    if (!revoked) {
      throw ApiErrors.notFound("Feature override");
    }

    void auditLogService.record({
      userId: input.revokedByUserId,
      action: AUDIT_ACTIONS.FEATURE_OVERRIDE_REVOKED,
      resource: `override:${input.overrideId}`,
      metadata: { reason: input.reason },
    });
  }

  /**
   * Admin-granted plan. Source is recorded so the operator can
   * distinguish from Stripe-driven plans. Honours the partial unique
   * "one current plan per account" constraint.
   */
  async grantPlan(input: IGrantPlanInput): Promise<{ id: string }> {
    return db.transaction(async (tx) => {
      await tx
        .update(accountPlans)
        .set({ revokedAt: now() })
        .where(
          and(
            eq(accountPlans.accountId, input.accountId),
            isNull(accountPlans.revokedAt)
          )
        );

      const [created] = await tx
        .insert(accountPlans)
        .values({
          accountId: input.accountId,
          planId: input.planId,
          status: "active",
          source: "admin_grant",
          expiresAt: input.expiresAt,
        })
        .returning({ id: accountPlans.id });

      if (!created) {
        throw ApiErrors.database("Failed to create admin-granted plan");
      }

      void auditLogService.record({
        userId: input.grantedByUserId,
        action: AUDIT_ACTIONS.PLAN_ADMIN_GRANTED,
        resource: `account_plan:${created.id}`,
        metadata: {
          accountId: input.accountId,
          planId: input.planId,
          expiresAt: input.expiresAt,
          reason: input.reason,
        },
      });

      return { id: created.id };
    });
  }
}

export const adminBillingService = new AdminBillingService();
