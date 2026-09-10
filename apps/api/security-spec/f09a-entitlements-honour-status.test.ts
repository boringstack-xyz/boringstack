/**
 * F09a: the runtime feature resolver ignores subscription status.
 *
 * `resolve-account-features.ts:25-30` selects the account's plan on
 * `revokedAt IS NULL` alone:
 *
 *   where: and(eq(accountPlans.accountId, accountId),
 *              isNull(accountPlans.revokedAt))
 *
 * `status`, `currentPeriodEnd` and `expiresAt` appear nowhere in the file.
 * The only time-based filtering in the ACL layer (`feature-resolution.ts:36`,
 * `isActiveOverride`) applies to overrides, not to the plan itself.
 *
 * The review's own probe used an unpaid subscription, which is the right
 * choice and the one repeated here. Worth recording why: `canceled` is the
 * one status that partially self-heals, because
 * `account-maintenance.jobs.ts:76-94` sweeps
 * `status='canceled' AND currentPeriodEnd < now()` hourly. A test written
 * against `canceled` would be asserting against a condition that resolves on
 * its own within the hour.
 *
 * `unpaid`, `paused`, `incomplete` and `past_due` are swept by nothing: the
 * sweeper's `eq(status, "canceled")` filter excludes them all. An account
 * whose card fails keeps its paid features permanently. That is what this
 * asserts.
 *
 * Scope note: `resolveAccountFeatures` has exactly one production caller,
 * `users.service.ts:76`, which builds the `/me` payload. Fixing this makes
 * the payload honest; it does not gate anything, because nothing on the API
 * enforces features. See f09c.
 *
 * POLICY (ROADMAP decision 3): encodes "delinquency loses paid features
 * immediately". A grace period is a legitimate alternative: express it by
 * asserting the boundary, not by dropping the assertion.
 */
import { beforeEach, describe, expect, test } from "bun:test";

import { resolveAccountFeatures } from "../src/lib/acl/resolve-account-features";
import {
  accountPlans,
  cleanDatabase,
  db,
  eq,
  planFeatures,
  plans,
} from "../tests/helpers/db";
import { seedVerifiedUser } from "../tests/helpers/auth";
import { requireDbOrFail } from "./harness";

const PAID_PLAN = "spec-paid";

/** Attaches a paid plan to the account in the given Stripe status. */
const givePaidPlan = async (
  accountId: string,
  status: string
): Promise<void> => {
  const [plan] = await db
    .insert(plans)
    .values({ name: PAID_PLAN, stripePriceId: "price_spec_paid" })
    .onConflictDoNothing()
    .returning();

  const existing = await db
    .select()
    .from(plans)
    .where(eq(plans.name, PAID_PLAN));
  const planId = plan?.id ?? existing[0]?.id;

  if (planId === undefined) {
    throw new Error("could not seed a paid plan");
  }

  /*
   * Grant the feature on the plan. Without this the assertion would hold
   * for the trivial reason that nothing grants can_export, which is a
   * vacuous pass rather than evidence about status handling.
   */
  await db
    .insert(planFeatures)
    .values({ planId, featureKey: "can_export", value: { bool: true } })
    .onConflictDoNothing();

  await db.insert(accountPlans).values({
    accountId,
    planId,
    status,
    source: "stripe",
    stripeSubscriptionId: "sub_spec_f09a",
    // Period ended a month ago; the card never cleared.
    currentPeriodEnd: new Date(Date.now() - 30 * 86_400_000).toISOString(),
  });
};

beforeEach(async () => {
  await requireDbOrFail();
  await cleanDatabase();
});

describe("F09a entitlements honour subscription status", () => {
  for (const status of ["unpaid", "past_due", "incomplete", "paused"]) {
    test(`a '${status}' subscription does not grant paid features`, async () => {
      const { account } = await seedVerifiedUser({
        email: `f09a-${status}@example.com`,
      });

      await givePaidPlan(account.id, status);

      const features = await resolveAccountFeatures(account.id);

      expect(features.can_export).toBe(false);
    });
  }

  test("control: an active subscription does grant them", async () => {
    const { account } = await seedVerifiedUser({
      email: "f09a-active@example.com",
    });

    await givePaidPlan(account.id, "active");

    await db
      .update(accountPlans)
      .set({
        currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      })
      .where(eq(accountPlans.accountId, account.id));

    const features = await resolveAccountFeatures(account.id);

    /*
     * Proves the fixture actually grants the feature, so a `false` above is
     * about status and not about an empty plan.
     */
    expect(features.can_export).toBe(true);
  });
});
