import { beforeEach, describe, expect, test } from "bun:test";

import { getBillingService } from "../../../src/api/billing/billing.service";
import { env } from "../../../src/config/env";
import { AUDIT_ACTIONS } from "../../../src/lib/audit-log";
import { ApiError } from "../../../src/lib/errors/api-error";
import { seedVerifiedUser } from "../../helpers/auth";
import {
  accountPlans,
  accounts,
  and,
  auditLog,
  cleanDatabase,
  db,
  eq,
  isNull,
  plans,
  requireDb,
  stripeWebhookEvents,
} from "../../helpers/db";
import {
  checkoutSessionCompletedEvent,
  customerSubscriptionUpdatedEvent,
} from "../../helpers/stripe-webhook-fixtures";

const seedAccountWithStripeCustomer = async (): Promise<{
  accountId: string;
  customerId: string;
  freePlanId: number;
  proPlanId: number;
}> => {
  const { account } = await seedVerifiedUser({
    email: `billing-wh-${String(Date.now())}@example.com`,
  });
  const customerId = `cus_test_${account.id.slice(0, 8)}`;

  await getBillingService().listPlans();

  await db
    .update(accounts)
    .set({ stripeCustomerId: customerId })
    .where(eq(accounts.id, account.id));

  const pro = await db.query.plans.findFirst({
    where: eq(plans.name, "Pro"),
  });
  const free = await db.query.plans.findFirst({
    where: eq(plans.name, "Free"),
  });

  if (!pro || !free) {
    throw new Error("Billing plans not seeded");
  }

  return {
    accountId: account.id,
    customerId,
    freePlanId: free.id,
    proPlanId: pro.id,
  };
};

describe("getBillingService", () => {
  test("returns the same singleton across calls (when BILLING_ENABLED=true in test env)", () => {
    const a = getBillingService();
    const b = getBillingService();

    expect(a).toBe(b);
  });
});

describe("billingService.listPlans", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("auto-seeds the Free + Pro plans on first call", async () => {
    if (!(await requireDb())) {
      return;
    }

    const result = await getBillingService().listPlans();

    expect(result.length).toBeGreaterThanOrEqual(2);

    const names = result.map((plan) => plan.name);

    expect(names).toContain("Free");
    expect(names).toContain("Pro");

    const free = result.find((plan) => plan.name === "Free");

    expect(free?.isDefault).toBe(true);
  });

  test("is idempotent on repeated calls (no duplicate rows)", async () => {
    if (!(await requireDb())) {
      return;
    }

    await getBillingService().listPlans();
    await getBillingService().listPlans();

    const rows = await db.select().from(plans);

    const names = rows.map((plan) => plan.name);

    expect(new Set(names).size).toBe(names.length);
  });

  test("returns rows ordered by name", async () => {
    if (!(await requireDb())) {
      return;
    }

    await getBillingService().listPlans();

    const rows = await db.select().from(plans);
    const names = rows.map((plan) => plan.name).sort();

    expect(names).toEqual([...names].sort());
  });
});

describe("billingService.constructWebhookEvent", () => {
  const webhookPayload = JSON.stringify({ id: "evt_test", type: "ping" });

  const expectConstructWebhookEventError = async (
    signature: string,
    stripeError: RegExp
  ): Promise<ApiError> => {
    let caught: unknown;

    try {
      await getBillingService().constructWebhookEvent(
        webhookPayload,
        signature
      );
    } catch (error: unknown) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);

    if (!(caught instanceof ApiError)) {
      throw new Error("expected ApiError");
    }

    expect(caught.statusCode).toBe(400);
    expect(caught.message).toMatch(/^Webhook signature error: /u);
    expect(caught.message).toMatch(stripeError);

    return caught;
  };

  test("rejects malformed Stripe-Signature header (token= instead of t=)", async () => {
    await expectConstructWebhookEventError(
      "token=0,v1=invalid",
      /Unable to extract timestamp and signatures from header/u
    );
  });

  test("rejects payloads whose signature does not match the configured secret", async () => {
    await expectConstructWebhookEventError(
      "t=0,v1=invalid",
      /No signatures found matching the expected signature/u
    );
  });
});

describe("billingService.handleWebhookEvent", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("deduplicates events by Stripe event id", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId, customerId, proPlanId } =
      await seedAccountWithStripeCustomer();
    const service = getBillingService();

    const event = await checkoutSessionCompletedEvent("evt_dup_1", {
      customer: customerId,
      metadata: { accountId, planId: String(proPlanId) },
    });

    await service.handleWebhookEvent(event);
    await service.handleWebhookEvent(event);

    const webhookRows = await db
      .select()
      .from(stripeWebhookEvents)
      .where(eq(stripeWebhookEvents.eventId, "evt_dup_1"));

    expect(webhookRows).toHaveLength(1);

    const activePlans = await db
      .select()
      .from(accountPlans)
      .where(
        and(
          eq(accountPlans.accountId, accountId),
          isNull(accountPlans.revokedAt)
        )
      );

    expect(activePlans).toHaveLength(1);
    expect(activePlans[0]?.planId).toBe(proPlanId);
  });

  test("checkout.session.completed activates the plan from metadata", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId, customerId, proPlanId } =
      await seedAccountWithStripeCustomer();

    await getBillingService().handleWebhookEvent(
      await checkoutSessionCompletedEvent("evt_checkout_ok", {
        customer: customerId,
        metadata: { accountId, planId: String(proPlanId) },
      })
    );

    const [row] = await db
      .select()
      .from(accountPlans)
      .where(
        and(
          eq(accountPlans.accountId, accountId),
          isNull(accountPlans.revokedAt)
        )
      );

    expect(row?.planId).toBe(proPlanId);
    expect(row?.status).toBe("active");
    expect(row?.source).toBe("stripe");
  });

  test("checkout.session.completed records a stripe.reconciled audit row for the account", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId, customerId, proPlanId } =
      await seedAccountWithStripeCustomer();

    await getBillingService().handleWebhookEvent(
      await checkoutSessionCompletedEvent("evt_checkout_audit", {
        customer: customerId,
        metadata: { accountId, planId: String(proPlanId) },
      })
    );

    /*
     * record() is fire-and-forget (void), so the insert can land after
     * handleWebhookEvent resolves — poll briefly instead of asserting
     * immediately (see tests/helpers/db.ts header).
     */
    const resource = `account:${accountId}`;
    let rows: (typeof auditLog.$inferSelect)[] = [];

    for (let attempt = 0; attempt < 20; attempt++) {
      rows = await db
        .select()
        .from(auditLog)
        .where(
          and(
            eq(auditLog.resource, resource),
            eq(auditLog.action, AUDIT_ACTIONS.STRIPE_RECONCILED)
          )
        );

      if (rows.length > 0) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    expect(rows).toHaveLength(1);
    expect(rows[0]?.action).toBe(AUDIT_ACTIONS.STRIPE_RECONCILED);
    expect(rows[0]?.userId).toBeNull();
    expect(rows[0]?.metadata).toEqual({
      eventId: "evt_checkout_audit",
      eventType: "checkout.session.completed",
      planId: proPlanId,
      status: "active",
    });
  });

  test("checkout.session.completed with missing metadata is a no-op (no throw)", async () => {
    if (!(await requireDb())) {
      return;
    }

    await seedAccountWithStripeCustomer();

    await getBillingService().handleWebhookEvent(
      await checkoutSessionCompletedEvent("evt_checkout_missing_meta", {
        customer: "cus_orphan",
      })
    );

    const planRows = await db.select().from(accountPlans);

    expect(planRows).toHaveLength(0);
  });

  test("checkout.session.completed is a no-op when the customer does not map to the metadata account", async () => {
    if (!(await requireDb())) {
      return;
    }

    const accountA = await seedAccountWithStripeCustomer();
    const accountB = await seedAccountWithStripeCustomer();

    /*
     * Event is signed for accountA's customer, but metadata names accountB.
     * The handler must re-derive the account from the customer and bail.
     */
    await getBillingService().handleWebhookEvent(
      await checkoutSessionCompletedEvent("evt_checkout_mismatch", {
        customer: accountA.customerId,
        metadata: {
          accountId: accountB.accountId,
          planId: String(accountB.proPlanId),
        },
      })
    );

    const planRows = await db.select().from(accountPlans);

    expect(planRows).toHaveLength(0);
  });

  test("customer.subscription.updated maps a known stripe price to the Pro plan", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId, customerId } = await seedAccountWithStripeCustomer();

    await getBillingService().handleWebhookEvent(
      await customerSubscriptionUpdatedEvent("evt_sub_updated", {
        id: "sub_test_1",
        customer: customerId,
        status: "active",
        created: 1_700_000_000,
        items: {
          data: [
            {
              price: { id: env.STRIPE_PRICE_ID_PRO },
              current_period_end: 1_800_000_000,
            },
          ],
        },
      })
    );

    const [row] = await db
      .select()
      .from(accountPlans)
      .where(
        and(
          eq(accountPlans.accountId, accountId),
          isNull(accountPlans.revokedAt)
        )
      );

    const proPlan = await db.query.plans.findFirst({
      where: eq(plans.name, "Pro"),
    });

    expect(row?.planId).toBe(proPlan?.id);
    expect(row?.status).toBe("active");
    expect(row?.stripeSubscriptionId).toBe("sub_test_1");
  });

  test("skips older subscription updates after a newer Stripe event has landed", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId, customerId, freePlanId, proPlanId } =
      await seedAccountWithStripeCustomer();
    const service = getBillingService();

    await service.handleWebhookEvent(
      await customerSubscriptionUpdatedEvent(
        "evt_sub_newer",
        {
          id: "sub_test_stale",
          customer: customerId,
          status: "active",
          created: 1_700_000_000,
          items: {
            data: [
              {
                price: { id: env.STRIPE_PRICE_ID_PRO },
                current_period_end: 1_800_000_000,
              },
            ],
          },
        },
        200
      )
    );

    await service.handleWebhookEvent(
      await customerSubscriptionUpdatedEvent(
        "evt_sub_older",
        {
          id: "sub_test_stale",
          customer: customerId,
          status: "active",
          created: 1_700_000_000,
          items: {
            data: [
              {
                price: { id: env.STRIPE_PRICE_ID_FREE },
                current_period_end: 1_800_000_000,
              },
            ],
          },
        },
        100
      )
    );

    const activePlans = await db
      .select()
      .from(accountPlans)
      .where(
        and(
          eq(accountPlans.accountId, accountId),
          isNull(accountPlans.revokedAt)
        )
      );

    expect(activePlans).toHaveLength(1);
    expect(activePlans[0]?.planId).toBe(proPlanId);
    expect(activePlans[0]?.planId).not.toBe(freePlanId);
    expect(activePlans[0]?.lastStripeEventId).toBe("evt_sub_newer");
  });

  test("customer.subscription.updated with unknown price id is a no-op (no throw)", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId, customerId } = await seedAccountWithStripeCustomer();

    await getBillingService().handleWebhookEvent(
      await customerSubscriptionUpdatedEvent("evt_sub_unknown_price", {
        id: "sub_unknown",
        customer: customerId,
        status: "active",
        created: 1_700_000_000,
        items: {
          data: [
            {
              price: { id: "price_does_not_exist" },
              current_period_end: 1_800_000_000,
            },
          ],
        },
      })
    );

    const rows = await db
      .select()
      .from(accountPlans)
      .where(eq(accountPlans.accountId, accountId));

    expect(rows).toHaveLength(0);
  });
});
