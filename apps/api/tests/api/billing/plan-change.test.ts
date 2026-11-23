import { beforeEach, describe, expect, test } from "bun:test";

import { getBillingService } from "../../../src/api/billing/billing.service";
import { paidPlanId } from "../../../src/api/billing/plan-change";
import { env } from "../../../src/config/env";
import { AUDIT_ACTIONS } from "../../../src/lib/audit-log";
import { seedVerifiedUser } from "../../helpers/auth";
import {
  accounts,
  and,
  auditLog,
  cleanDatabase,
  db,
  eq,
  plans,
  requireDb,
} from "../../helpers/db";
import {
  checkoutSessionCompletedEvent,
  customerSubscriptionDeletedEvent,
  customerSubscriptionUpdatedEvent,
} from "../../helpers/stripe-webhook-fixtures";

/*
 * The "plan changed" audit rows count real changes of what an account pays
 * for. One row per change, however many Stripe events describe it.
 */
const seed = async (): Promise<{
  accountId: string;
  customerId: string;
  proPlanId: number;
}> => {
  const { account } = await seedVerifiedUser({
    email: `plan-changed-${String(Date.now())}@example.com`,
  });
  const customerId = `cus_test_${account.id.slice(0, 8)}`;

  await getBillingService().listPlans();
  await db
    .update(accounts)
    .set({ stripeCustomerId: customerId })
    .where(eq(accounts.id, account.id));

  const pro = await db.query.plans.findFirst({ where: eq(plans.name, "Pro") });

  if (!pro) {
    throw new Error("Billing plans not seeded");
  }

  return { accountId: account.id, customerId, proPlanId: pro.id };
};

/* record() is fire-and-forget, so give the insert a moment to land. */
const planChanges = async (
  accountId: string,
  expected: number
): Promise<(typeof auditLog.$inferSelect)[]> => {
  let rows: (typeof auditLog.$inferSelect)[] = [];

  for (let attempt = 0; attempt < 12; attempt++) {
    rows = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.targetAccountId, accountId),
          eq(auditLog.action, AUDIT_ACTIONS.PLAN_CHANGED)
        )
      );

    if (rows.length > expected) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return rows;
};

const subscription = (
  customerId: string,
  status: "active" | "canceled"
): Parameters<typeof customerSubscriptionUpdatedEvent>[1] => ({
  id: "sub_plan_changed",
  customer: customerId,
  status,
  created: 1_700_000_000,
  items: {
    data: [
      {
        price: { id: env.STRIPE_PRICE_ID_PRO },
        current_period_end: 1_800_000_000,
      },
    ],
  },
});

describe("paidPlanId", () => {
  test("is the plan while the status entitles the account, and none otherwise", () => {
    expect(paidPlanId(undefined)).toBeNull();
    expect(paidPlanId({ planId: 2, status: "active" })).toBe(2);
    expect(paidPlanId({ planId: 2, status: "trialing" })).toBe(2);
    expect(paidPlanId({ planId: 2, status: "incomplete" })).toBeNull();
    expect(paidPlanId({ planId: 2, status: "canceled" })).toBeNull();
    expect(paidPlanId({ planId: 2, status: "past_due" })).toBeNull();
  });
});

describe("plan.changed audit events", () => {
  beforeEach(async () => {
    if (await requireDb()) {
      await cleanDatabase();
    }
  });

  test("a paid checkout and its subscription event record one plan change", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId, customerId, proPlanId } = await seed();
    const service = getBillingService();

    await service.handleWebhookEvent(
      await checkoutSessionCompletedEvent("evt_pc_checkout", {
        customer: customerId,
        subscription: "sub_plan_changed",
        metadata: { accountId, planId: String(proPlanId) },
      })
    );
    await service.handleWebhookEvent(
      await customerSubscriptionUpdatedEvent(
        "evt_pc_sub",
        subscription(customerId, "active")
      )
    );

    const rows = await planChanges(accountId, 1);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBeNull();
    expect(rows[0]?.metadata).toMatchObject({
      toPlanId: proPlanId,
      toStatus: "active",
    });
  });

  test("a subscription event that arrives before its checkout records one plan change", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId, customerId, proPlanId } = await seed();
    const service = getBillingService();

    await service.handleWebhookEvent(
      await customerSubscriptionUpdatedEvent(
        "evt_pc_sub_first",
        subscription(customerId, "active")
      )
    );
    await service.handleWebhookEvent(
      await checkoutSessionCompletedEvent("evt_pc_checkout_second", {
        customer: customerId,
        subscription: "sub_plan_changed",
        metadata: { accountId, planId: String(proPlanId) },
      })
    );

    expect(await planChanges(accountId, 1)).toHaveLength(1);
  });

  test("an unpaid checkout is not a plan change", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId, customerId, proPlanId } = await seed();

    await getBillingService().handleWebhookEvent(
      await checkoutSessionCompletedEvent("evt_pc_unpaid", {
        customer: customerId,
        subscription: "sub_plan_changed",
        payment_status: "unpaid",
        metadata: { accountId, planId: String(proPlanId) },
      })
    );

    expect(await planChanges(accountId, 0)).toHaveLength(0);
  });

  test("the end of a paid subscription is a plan change", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId, customerId } = await seed();
    const service = getBillingService();

    await service.handleWebhookEvent(
      await customerSubscriptionUpdatedEvent(
        "evt_pc_start",
        subscription(customerId, "active")
      )
    );
    await service.handleWebhookEvent(
      await customerSubscriptionDeletedEvent(
        "evt_pc_end",
        subscription(customerId, "canceled")
      )
    );

    const rows = await planChanges(accountId, 2);

    expect(rows).toHaveLength(2);
    const written = rows.map((row) => JSON.stringify(row.metadata));

    expect(written.some((text) => text.includes('"toStatus":"active"'))).toBe(
      true
    );
    expect(written.some((text) => text.includes('"toStatus":"canceled"'))).toBe(
      true
    );
  });
});
