import { and, eq, isNull } from "drizzle-orm";

import { db } from "../../clients/postgres";
import {
  accountPlans,
  planFeatures,
  plans,
} from "../../clients/postgres/schema";
import { ApiErrors } from "../../lib/errors";
import { nowMs } from "../../lib/time/now";

/**
 * Attaches a seated team plan to an account, for end-to-end fixtures only.
 *
 * Multi-member flows (account switching, leaving an account) need a second
 * membership, and the only paths to one are invitation and join-request
 * approval. Both now check `can_invite_team` and `max_seats`, which the
 * free plan does not grant, so a browser test cannot build the state it
 * exercises without a plan behind it.
 *
 * Seeding the membership row directly would dodge that, and dodge the
 * policy the route is there to apply: the fixture would then keep passing
 * against an API that had stopped enforcing anything.
 *
 * The route that calls this returns 404 unless NODE_ENV=test or
 * E2E_TEST_ENDPOINTS_ENABLED is on, and `boot/invariants.ts` refuses to
 * start a production process with that flag set.
 */
export const TEST_TEAM_PLAN_NAME = "e2e-team";
const TEST_TEAM_SEATS = 25;
const PLAN_PERIOD_MS = 30 * 86_400_000;

export const grantTestTeamPlan = async (accountId: string): Promise<void> => {
  await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(plans)
      .values({
        name: TEST_TEAM_PLAN_NAME,
        stripePriceId: `price_${TEST_TEAM_PLAN_NAME}`,
      })
      .onConflictDoNothing()
      .returning({ id: plans.id });

    const existing =
      inserted ??
      (await tx.query.plans.findFirst({
        where: eq(plans.name, TEST_TEAM_PLAN_NAME),
      }));

    if (existing === undefined) {
      throw ApiErrors.internal("test plan row could not be resolved");
    }

    const planId = existing.id;

    for (const feature of [
      { featureKey: "can_invite_team", value: { bool: true } },
      { featureKey: "max_seats", value: { number: TEST_TEAM_SEATS } },
    ]) {
      await tx
        .insert(planFeatures)
        .values({ planId, ...feature })
        .onConflictDoUpdate({
          target: [planFeatures.planId, planFeatures.featureKey],
          set: { value: feature.value },
        });
    }

    const current = await tx.query.accountPlans.findFirst({
      where: and(
        eq(accountPlans.accountId, accountId),
        isNull(accountPlans.revokedAt)
      ),
    });

    if (current !== undefined) {
      await tx
        .update(accountPlans)
        .set({ planId, status: "active" })
        .where(
          and(
            eq(accountPlans.id, current.id),
            eq(accountPlans.accountId, accountId)
          )
        );

      return;
    }

    await tx.insert(accountPlans).values({
      accountId,
      planId,
      status: "active",
      source: "manual",
      currentPeriodEnd: new Date(nowMs() + PLAN_PERIOD_MS).toISOString(),
    });
  });
};
