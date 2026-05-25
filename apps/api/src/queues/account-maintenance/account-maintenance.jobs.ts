import { and, eq, isNotNull, isNull, lt } from "drizzle-orm";

import { db } from "../../clients/postgres";
import {
  accountFeatureOverrides,
  accountInvitations,
  accountPlans,
  accounts,
  users,
} from "../../clients/postgres/schema";
import { logger } from "../../config/logger";
import { now } from "../../lib/time/now";

const MS_PER_DAY = 86_400_000;
const HARD_DELETE_GRACE_DAYS = 30;
const PENDING_USER_GRACE_DAYS = 30;

/**
 * Sweeps expired `account_feature_overrides`. Idempotent: rows already
 * carrying `revoked_at` are skipped by the `isNull(revokedAt)` filter.
 */
export const expireFeatureOverridesJob = async (): Promise<{
  swept: number;
}> => {
  const sweptAt = now();
  const result = await db
    .update(accountFeatureOverrides)
    .set({ revokedAt: sweptAt, revokedReason: "expired" })
    .where(
      and(
        isNull(accountFeatureOverrides.revokedAt),
        isNotNull(accountFeatureOverrides.expiresAt),
        lt(accountFeatureOverrides.expiresAt, sweptAt)
      )
    )
    .returning({ id: accountFeatureOverrides.id });

  if (result.length > 0) {
    logger.info("Expired feature overrides", {
      event: "billing.user_plan.updated",
      count: result.length,
    });
  }

  return { swept: result.length };
};

/**
 * Sweeps expired admin-granted plans (revokes the row). The
 * separate `downgradeCanceledStripePlansJob` handles Stripe-driven
 * canceled plans that have passed their `current_period_end`.
 */
export const expireAdminPlansJob = async (): Promise<{ swept: number }> => {
  const sweptAt = now();
  const result = await db
    .update(accountPlans)
    .set({ revokedAt: sweptAt })
    .where(
      and(
        isNull(accountPlans.revokedAt),
        eq(accountPlans.source, "admin_grant"),
        isNotNull(accountPlans.expiresAt),
        lt(accountPlans.expiresAt, sweptAt)
      )
    )
    .returning({ id: accountPlans.id });

  return { swept: result.length };
};

/**
 * Sweeps Stripe-canceled plans whose `current_period_end` has passed.
 * Revokes the row so the resolver falls back to the Free plan on the
 * next request.
 */
export const downgradeCanceledStripePlansJob = async (): Promise<{
  swept: number;
}> => {
  const sweptAt = now();
  const result = await db
    .update(accountPlans)
    .set({ revokedAt: sweptAt })
    .where(
      and(
        isNull(accountPlans.revokedAt),
        eq(accountPlans.status, "canceled"),
        isNotNull(accountPlans.currentPeriodEnd),
        lt(accountPlans.currentPeriodEnd, sweptAt)
      )
    )
    .returning({ id: accountPlans.id });

  return { swept: result.length };
};

/**
 * Hard-deletes accounts whose `deleted_at` is past the configured
 * grace window. FK cascades wipe `account_memberships`,
 * `account_plans`, `account_feature_overrides`, `account_invitations`,
 * and every `@account-scoped` row. `audit.audit_log` survives by
 * design (no FK cascade).
 */
export const hardDeleteSoftDeletedAccountsJob = async (): Promise<{
  swept: number;
}> => {
  const cutoff = new Date(
    Date.now() - HARD_DELETE_GRACE_DAYS * MS_PER_DAY
  ).toISOString();
  const result = await db
    .delete(accounts)
    .where(and(isNotNull(accounts.deletedAt), lt(accounts.deletedAt, cutoff)))
    .returning({ id: accounts.id });

  return { swept: result.length };
};

/**
 * Hard-deletes pending users (no verified email) older than the
 * configured grace window. FK cascades drop `auth.user_auth_providers`
 * and `auth.email_verification_tokens` rows; the `audit.audit_log`
 * trail is intentionally preserved (no FK cascade) so the registration
 * attempt remains traceable. No personal account exists to clean up —
 * the whole point of verify-before-account is that pending users never
 * had one.
 */
export const cleanStalePendingUsersJob = async (): Promise<{
  swept: number;
}> => {
  const cutoff = new Date(
    Date.now() - PENDING_USER_GRACE_DAYS * MS_PER_DAY
  ).toISOString();
  const result = await db
    .delete(users)
    .where(and(isNull(users.emailVerifiedAt), lt(users.createdAt, cutoff)))
    .returning({ id: users.id });

  if (result.length > 0) {
    logger.info("Cleaned stale pending users", {
      event: "auth.pending_user.cleaned",
      count: result.length,
    });
  }

  return { swept: result.length };
};

/**
 * Sweeps `account_invitations` that have expired without being
 * accepted. Sets `revokedAt` so the audit trail reflects the reason.
 */
export const cleanExpiredInvitationsJob = async (): Promise<{
  swept: number;
}> => {
  const sweptAt = now();
  const result = await db
    .update(accountInvitations)
    .set({ revokedAt: sweptAt })
    .where(
      and(
        isNull(accountInvitations.acceptedAt),
        isNull(accountInvitations.revokedAt),
        lt(accountInvitations.expiresAt, sweptAt)
      )
    )
    .returning({ id: accountInvitations.id });

  return { swept: result.length };
};
