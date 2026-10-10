import { beforeEach, describe, expect, test } from "bun:test";

import {
  BillingService,
  getBillingService,
  listBillingPlans,
} from "../../../src/api/billing/billing.service";
import { env } from "../../../src/config/env";
import { FEATURE_KEYS } from "../../../src/lib/acl/acl.constants";
import { resolveAccountFeatures } from "../../../src/lib/acl";
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
  planFeatures,
  plans,
  requireDb,
  stripeWebhookEvents,
} from "../../helpers/db";
import {
  checkoutSessionCompletedEvent,
  checkoutSessionEvent,
  createFakeStripe,
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
     * handleWebhookEvent resolves, poll briefly instead of asserting
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

const FRONTEND_SUCCESS_URL = `${env.FRONTEND_URL}/billing/success`;
const FRONTEND_CANCEL_URL = `${env.FRONTEND_URL}/billing/cancel`;
const BASE_EVENT_TIME = 1_800_000_000;

let ownerSequence = 0;

const seedOwner = async (): Promise<{ accountId: string; userId: string }> => {
  ownerSequence += 1;

  const { account, user } = await seedVerifiedUser({
    email: `owner-${String(ownerSequence)}-${String(Date.now())}@example.com`,
  });

  return { accountId: account.id, userId: user.id };
};

const planIdByName = async (name: string): Promise<number> => {
  await listBillingPlans();

  const plan = await db.query.plans.findFirst({ where: eq(plans.name, name) });

  if (!plan) {
    throw new Error(`plan ${name} not seeded`);
  }

  return plan.id;
};

const currentPlanRow = async (accountId: string) =>
  db.query.accountPlans.findFirst({
    where: and(
      eq(accountPlans.accountId, accountId),
      isNull(accountPlans.revokedAt)
    ),
  });

const canExport = async (accountId: string): Promise<boolean> => {
  const features = await resolveAccountFeatures(accountId);

  return features.can_export;
};

const captureApiError = async (
  run: () => Promise<unknown>
): Promise<ApiError> => {
  try {
    await run();
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      return error;
    }

    throw error;
  }

  throw new Error("expected the call to throw an ApiError");
};

describe("billingService.createCheckoutSession", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("rejects the default Free plan with a 400 before contacting Stripe", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId, userId } = await seedOwner();
    const fake = createFakeStripe();
    const freePlanId = await planIdByName("Free");

    const error = await captureApiError(() =>
      new BillingService({ stripe: fake.stripe }).createCheckoutSession(
        freePlanId,
        accountId,
        userId,
        FRONTEND_SUCCESS_URL,
        FRONTEND_CANCEL_URL
      )
    );

    expect(error.statusCode).toBe(400);
    expect(fake.requests).toHaveLength(0);
  });

  test("rejects a yearly checkout when no yearly price is configured, before contacting Stripe", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId, userId } = await seedOwner();
    const fake = createFakeStripe();
    const proPlanId = await planIdByName("Pro");
    const service = new BillingService({
      stripe: fake.stripe,
      settings: {
        enabled: true,
        priceIds: {
          free: "price_free",
          proMonthly: "price_pro",
          proYearly: "",
        },
      },
    });

    const error = await captureApiError(() =>
      service.createCheckoutSession(
        proPlanId,
        accountId,
        userId,
        FRONTEND_SUCCESS_URL,
        FRONTEND_CANCEL_URL,
        "year"
      )
    );

    expect(error.statusCode).toBe(400);
    expect(error.message).toMatch(/interval/u);
    expect(fake.requests).toHaveLength(0);
  });

  test("creates the Stripe customer once and a monthly session on the monthly Pro price", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId, userId } = await seedOwner();
    const fake = createFakeStripe();
    const proPlanId = await planIdByName("Pro");

    const result = await new BillingService({
      stripe: fake.stripe,
    }).createCheckoutSession(
      proPlanId,
      accountId,
      userId,
      FRONTEND_SUCCESS_URL,
      FRONTEND_CANCEL_URL
    );

    expect(result.url).toMatch(/^https:\/\/checkout\.stripe\.test\//u);
    expect(fake.sessions).toHaveLength(1);
    expect(fake.sessions[0]?.metadata).toEqual({
      planId: String(proPlanId),
      priceId: env.STRIPE_PRICE_ID_PRO,
      accountId,
    });

    const customerCreates = fake.requests.filter(
      (request) => request.path === "/v1/customers"
    );

    expect(customerCreates).toHaveLength(1);
    expect(customerCreates[0]?.idempotencyKey).toBe(
      `account-customer:${accountId}`
    );

    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    });

    expect(account?.stripeCustomerId).toMatch(/^cus_fake_/u);
  });

  test("interval year uses the yearly Pro price", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId, userId } = await seedOwner();
    const fake = createFakeStripe();
    const proPlanId = await planIdByName("Pro");

    await new BillingService({ stripe: fake.stripe }).createCheckoutSession(
      proPlanId,
      accountId,
      userId,
      FRONTEND_SUCCESS_URL,
      FRONTEND_CANCEL_URL,
      "year"
    );

    expect(fake.sessions[0]?.metadata.priceId).toBe(
      env.STRIPE_PRICE_ID_PRO_YEARLY
    );
  });

  test("two concurrent checkouts for one account create one session and return the same URL", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId, userId } = await seedOwner();
    const fake = createFakeStripe();
    const service = new BillingService({ stripe: fake.stripe });
    const proPlanId = await planIdByName("Pro");

    const [first, second] = await Promise.all([
      service.createCheckoutSession(
        proPlanId,
        accountId,
        userId,
        FRONTEND_SUCCESS_URL,
        FRONTEND_CANCEL_URL
      ),
      service.createCheckoutSession(
        proPlanId,
        accountId,
        userId,
        FRONTEND_SUCCESS_URL,
        FRONTEND_CANCEL_URL
      ),
    ]);

    expect(second.url).toBe(first.url);
    expect(fake.sessions).toHaveLength(1);
    expect(
      fake.requests.filter((request) => request.path === "/v1/customers")
    ).toHaveLength(1);
  });

  test("a second checkout for the same plan and interval reuses the open session", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId, userId } = await seedOwner();
    const fake = createFakeStripe();
    const service = new BillingService({ stripe: fake.stripe });
    const proPlanId = await planIdByName("Pro");

    const first = await service.createCheckoutSession(
      proPlanId,
      accountId,
      userId,
      FRONTEND_SUCCESS_URL,
      FRONTEND_CANCEL_URL
    );
    const second = await service.createCheckoutSession(
      proPlanId,
      accountId,
      userId,
      FRONTEND_SUCCESS_URL,
      FRONTEND_CANCEL_URL
    );

    expect(second.url).toBe(first.url);
    expect(fake.sessions).toHaveLength(1);
  });

  test("a different interval is a different price, so it gets its own session", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId, userId } = await seedOwner();
    const fake = createFakeStripe();
    const service = new BillingService({ stripe: fake.stripe });
    const proPlanId = await planIdByName("Pro");

    await service.createCheckoutSession(
      proPlanId,
      accountId,
      userId,
      FRONTEND_SUCCESS_URL,
      FRONTEND_CANCEL_URL,
      "month"
    );
    await service.createCheckoutSession(
      proPlanId,
      accountId,
      userId,
      FRONTEND_SUCCESS_URL,
      FRONTEND_CANCEL_URL,
      "year"
    );

    expect(fake.sessions).toHaveLength(2);
  });

  test("rejects with a 409 when the local subscription row is live, without creating a session", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId, userId } = await seedOwner();
    const fake = createFakeStripe();
    const proPlanId = await planIdByName("Pro");

    await db.insert(accountPlans).values({
      accountId,
      planId: proPlanId,
      status: "active",
      source: "stripe",
      stripeSubscriptionId: "sub_local_live",
    });

    const error = await captureApiError(() =>
      new BillingService({ stripe: fake.stripe }).createCheckoutSession(
        proPlanId,
        accountId,
        userId,
        FRONTEND_SUCCESS_URL,
        FRONTEND_CANCEL_URL
      )
    );

    expect(error.statusCode).toBe(409);
    expect(error.message).toBe(
      "Manage your existing subscription from Billing"
    );
    expect(fake.sessions).toHaveLength(0);
  });

  test("an admin-granted plan without a Stripe subscription does not block checkout", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId, userId } = await seedOwner();
    const fake = createFakeStripe();
    const proPlanId = await planIdByName("Pro");

    await db.insert(accountPlans).values({
      accountId,
      planId: proPlanId,
      status: "active",
      source: "admin_grant",
    });

    const result = await new BillingService({
      stripe: fake.stripe,
    }).createCheckoutSession(
      proPlanId,
      accountId,
      userId,
      FRONTEND_SUCCESS_URL,
      FRONTEND_CANCEL_URL
    );

    expect(result.url).toContain("https://");
    expect(fake.sessions).toHaveLength(1);
  });

  test("rejects with a 409 when Stripe lists a live subscription the webhook has not reported yet", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId, userId } = await seedOwner();
    const fake = createFakeStripe();
    const proPlanId = await planIdByName("Pro");

    await db
      .update(accounts)
      .set({ stripeCustomerId: "cus_webhook_lag" })
      .where(eq(accounts.id, accountId));
    fake.subscriptions.push({
      id: "sub_webhook_lag",
      customer: "cus_webhook_lag",
      status: "active",
    });

    const error = await captureApiError(() =>
      new BillingService({ stripe: fake.stripe }).createCheckoutSession(
        proPlanId,
        accountId,
        userId,
        FRONTEND_SUCCESS_URL,
        FRONTEND_CANCEL_URL
      )
    );

    expect(error.statusCode).toBe(409);
    expect(fake.sessions).toHaveLength(0);
  });

  test("a canceled local row and a canceled Stripe subscription do not block a new checkout", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId, userId } = await seedOwner();
    const fake = createFakeStripe();
    const proPlanId = await planIdByName("Pro");

    await db.insert(accountPlans).values({
      accountId,
      planId: proPlanId,
      status: "canceled",
      source: "stripe",
      stripeSubscriptionId: "sub_local_canceled",
    });
    await db
      .update(accounts)
      .set({ stripeCustomerId: "cus_canceled" })
      .where(eq(accounts.id, accountId));
    fake.subscriptions.push({
      id: "sub_stripe_canceled",
      customer: "cus_canceled",
      status: "canceled",
    });

    const result = await new BillingService({
      stripe: fake.stripe,
    }).createCheckoutSession(
      proPlanId,
      accountId,
      userId,
      FRONTEND_SUCCESS_URL,
      FRONTEND_CANCEL_URL
    );

    expect(result.url).toMatch(/^https:\/\//u);
    expect(fake.sessions).toHaveLength(1);
  });
});

describe("billingService.listPlans (public catalog)", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("reads without a Stripe client and reports no purchasable interval when billing is disabled", async () => {
    if (!(await requireDb())) {
      return;
    }

    const result = await listBillingPlans({
      enabled: false,
      priceIds: {
        free: "price_free",
        proMonthly: "price_pro",
        proYearly: "price_pro_yearly",
      },
    });

    expect(result.map((plan) => plan.purchasableIntervals)).toEqual(
      result.map(() => [])
    );
  });

  test("reports month and year as purchasable for Pro when both prices are configured; Free is never purchasable", async () => {
    if (!(await requireDb())) {
      return;
    }

    const result = await listBillingPlans({
      enabled: true,
      priceIds: {
        free: "price_free",
        proMonthly: "price_pro",
        proYearly: "price_pro_yearly",
      },
    });

    expect(
      result.find((plan) => plan.name === "Pro")?.purchasableIntervals
    ).toEqual(["month", "year"]);
    expect(
      result.find((plan) => plan.name === "Free")?.purchasableIntervals
    ).toEqual([]);
  });

  test("reports only month when the yearly price is unset", async () => {
    if (!(await requireDb())) {
      return;
    }

    const result = await listBillingPlans({
      enabled: true,
      priceIds: { free: "price_free", proMonthly: "price_pro", proYearly: "" },
    });

    expect(
      result.find((plan) => plan.name === "Pro")?.purchasableIntervals
    ).toEqual(["month"]);
  });

  test("removes a stored feature row the catalog no longer assigns to a built-in plan", async () => {
    if (!(await requireDb())) {
      return;
    }

    await listBillingPlans();

    const freeId = await planIdByName("Free");

    await db.insert(planFeatures).values({
      planId: freeId,
      featureKey: "max_seats",
      value: { number: 99 },
    });

    await listBillingPlans();

    const freeRows = await db.query.planFeatures.findMany({
      where: eq(planFeatures.planId, freeId),
    });

    expect(freeRows).toHaveLength(0);
  });

  test("seeds one feature row per key for Pro and none for Free, idempotently", async () => {
    if (!(await requireDb())) {
      return;
    }

    await listBillingPlans();
    await listBillingPlans();

    const proId = await planIdByName("Pro");
    const freeId = await planIdByName("Free");
    const proRows = await db.query.planFeatures.findMany({
      where: eq(planFeatures.planId, proId),
    });
    const freeRows = await db.query.planFeatures.findMany({
      where: eq(planFeatures.planId, freeId),
    });

    expect(proRows.map((row) => row.featureKey).sort()).toEqual(
      [...FEATURE_KEYS].sort()
    );
    expect(freeRows).toHaveLength(0);
  });
});

describe("billingService entitlements after Stripe events", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("a paid Pro checkout resolves Pro features; Free resolves the defaults", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId, customerId, proPlanId } =
      await seedAccountWithStripeCustomer();

    expect(await resolveAccountFeatures(accountId)).toEqual({
      can_export: false,
      can_invite_team: false,
      max_seats: 1,
    });

    await getBillingService().handleWebhookEvent(
      await checkoutSessionCompletedEvent("evt_ent_paid", {
        customer: customerId,
        metadata: { accountId, planId: String(proPlanId) },
        subscription: "sub_ent_paid",
      })
    );

    expect(await resolveAccountFeatures(accountId)).toEqual({
      can_export: true,
      can_invite_team: true,
      max_seats: 10,
    });
  });

  test("an unpaid (delayed payment) checkout is incomplete and grants no paid features", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId, customerId, proPlanId } =
      await seedAccountWithStripeCustomer();

    await getBillingService().handleWebhookEvent(
      await checkoutSessionCompletedEvent(
        "evt_unpaid_checkout",
        {
          customer: customerId,
          metadata: { accountId, planId: String(proPlanId) },
          subscription: "sub_unpaid",
          payment_status: "unpaid",
        },
        BASE_EVENT_TIME
      )
    );

    const row = await currentPlanRow(accountId);

    expect(row?.status).toBe("incomplete");
    expect(row?.stripeSubscriptionId).toBe("sub_unpaid");
    expect(await canExport(accountId)).toBe(false);
  });

  test("async_payment_succeeded activates a delayed checkout and grants Pro features", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId, customerId, proPlanId } =
      await seedAccountWithStripeCustomer();
    const service = getBillingService();
    const session = {
      customer: customerId,
      metadata: { accountId, planId: String(proPlanId) },
      subscription: "sub_delayed_ok",
    };

    await service.handleWebhookEvent(
      await checkoutSessionEvent(
        "checkout.session.completed",
        "evt_delayed_1",
        { ...session, payment_status: "unpaid" },
        BASE_EVENT_TIME
      )
    );
    await service.handleWebhookEvent(
      await checkoutSessionEvent(
        "checkout.session.async_payment_succeeded",
        "evt_delayed_2",
        { ...session, payment_status: "paid" },
        BASE_EVENT_TIME + 60
      )
    );

    const activeRow = await currentPlanRow(accountId);

    expect(activeRow?.status).toBe("active");
    expect(await canExport(accountId)).toBe(true);
  });

  test("async_payment_failed marks the subscription incomplete and removes paid features", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId, customerId, proPlanId } =
      await seedAccountWithStripeCustomer();
    const service = getBillingService();
    const session = {
      customer: customerId,
      metadata: { accountId, planId: String(proPlanId) },
      subscription: "sub_delayed_fail",
    };

    await service.handleWebhookEvent(
      await checkoutSessionEvent(
        "checkout.session.async_payment_succeeded",
        "evt_fail_1",
        { ...session, payment_status: "paid" },
        BASE_EVENT_TIME
      )
    );
    expect(await canExport(accountId)).toBe(true);

    await service.handleWebhookEvent(
      await checkoutSessionEvent(
        "checkout.session.async_payment_failed",
        "evt_fail_2",
        { ...session, payment_status: "unpaid" },
        BASE_EVENT_TIME + 60
      )
    );

    const failedRow = await currentPlanRow(accountId);

    expect(failedRow?.status).toBe("incomplete");
    expect(await canExport(accountId)).toBe(false);
  });

  test("customer.subscription.updated maps the yearly Pro price to the Pro plan", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId, customerId } = await seedAccountWithStripeCustomer();

    await getBillingService().handleWebhookEvent(
      await customerSubscriptionUpdatedEvent("evt_yearly_sub", {
        id: "sub_yearly",
        customer: customerId,
        status: "active",
        created: 1_700_000_000,
        items: {
          data: [
            {
              price: { id: env.STRIPE_PRICE_ID_PRO_YEARLY },
              current_period_end: 1_800_000_000,
            },
          ],
        },
      })
    );

    const row = await currentPlanRow(accountId);
    const proId = await planIdByName("Pro");

    expect(row?.planId).toBe(proId);
    expect(row?.status).toBe("active");
  });

  test("customer.subscription.updated ignores a price that no built-in plan sells", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId, customerId } = await seedAccountWithStripeCustomer();

    await getBillingService().handleWebhookEvent(
      await customerSubscriptionUpdatedEvent("evt_unknown_price", {
        id: "sub_unknown_price",
        customer: customerId,
        status: "active",
        created: 1_700_000_000,
        items: {
          data: [
            {
              price: { id: "price_not_ours" },
              current_period_end: 1_800_000_000,
            },
          ],
        },
      })
    );

    expect(await currentPlanRow(accountId)).toBeUndefined();
  });
});
