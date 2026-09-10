/**
 * F10 — Stripe reconciliation ignores subscription identity.
 *
 * F10a: `handleSubscriptionDeleted` (billing.service.ts:519-553) resolves the
 * account by CUSTOMER id and then cancels whatever plan is current:
 *
 *   .where(and(eq(accountPlans.accountId, account.id),
 *              isNull(accountPlans.revokedAt)))
 *
 * `subscription.id` is never read. The upsert path does persist it
 * (`:497 stripeSubscriptionId: subscription.id`), so the column exists and is
 * populated — the delete path simply declines to filter on it. A late
 * `deleted` event for an old subscription therefore cancels the current one.
 * Stripe does not guarantee delivery order, and cancel-then-resubscribe
 * followed by a retry produces exactly this sequence.
 *
 * F10b: checkout completion (`:416-423`) writes `status: "active"` with no
 * `stripeSubscriptionId`, no `currentPeriodEnd` and no
 * `stripeSubscriptionCreatedAt`. Two consequences: `getSubscription` reports
 * `hasStripeSubscription: false`, and the hourly downgrade sweeper can never
 * revoke the row because it requires `isNotNull(currentPeriodEnd)`. The row
 * is permanently unsweepable. The write is also destructive — `:406-414`
 * revokes the existing plan first, so a late checkout event clobbers the
 * richer row written by `subscription.updated`.
 *
 * Ordering is guarded only by `shouldSkipStaleStripeEvent` (`:55-66`), a
 * strict `>` against Stripe's second-granularity `created`. Same-second
 * events both apply and the last delivery wins. `ensureIdempotent` correctly
 * dedupes retries of the SAME event; the gap is ordering between different
 * events.
 */
import { beforeEach, describe, expect, test } from "bun:test";

import { getBillingService } from "../src/api/billing/billing.service";
import {
  accountPlans,
  accounts,
  and,
  cleanDatabase,
  db,
  eq,
  isNull,
  plans,
} from "../tests/helpers/db";
import { seedVerifiedUser } from "../tests/helpers/auth";
import {
  checkoutSessionCompletedEvent,
  customerSubscriptionDeletedEvent,
  customerSubscriptionUpdatedEvent,
} from "../tests/helpers/stripe-webhook-fixtures";
import { requireDbOrFail, specPrecondition } from "./harness";

const CUSTOMER = "cus_spec_f10";
const PRICE = "price_spec";
const PLAN_NAME = "spec-f10";
const OLD_SUB = "sub_old_f10";
const NEW_SUB = "sub_new_f10";

/*
 * Built through the shared fixture helper, which round-trips the payload
 * through Stripe's own signer and `constructEventAsync`. The result is a real
 * `Stripe.Event` rather than a cast partial, and it exercises the same
 * signature-verification path production uses.
 */
const subscriptionPayload = (
  subscriptionId: string,
  createdAtSeconds: number,
  status = "active"
): {
  id: string;
  customer: string;
  status: string;
  created: number;
  items: { data: { price: { id: string }; current_period_end: number }[] };
} => ({
  id: subscriptionId,
  customer: CUSTOMER,
  status,
  created: createdAtSeconds,
  items: {
    data: [
      {
        price: { id: PRICE },
        current_period_end: createdAtSeconds + 2_592_000,
      },
    ],
  },
});

const currentPlan = async (accountId: string) =>
  db
    .select()
    .from(accountPlans)
    .where(
      and(eq(accountPlans.accountId, accountId), isNull(accountPlans.revokedAt))
    );

interface IBillingFixture {
  readonly accountId: string;
  readonly planId: number;
}

/**
 * An account with a Stripe customer id, plus a plan carrying the price the
 * fixtures reference.
 *
 * Both halves are load-bearing. `handleSubscriptionUpsert` resolves the plan
 * by `stripePriceId` and returns early when it finds none
 * (`billing.service.ts:469`), so without the plan row nothing is ever written
 * and every assertion below would fail against an empty table rather than
 * against the behaviour under test.
 */
const seedBillingFixture = async (): Promise<IBillingFixture> => {
  const { account } = await seedVerifiedUser({ email: "f10@gmail.com" });

  await db
    .update(accounts)
    .set({ stripeCustomerId: CUSTOMER })
    .where(eq(accounts.id, account.id));

  /*
   * `cleanDatabase` leaves `billing.plans` alone — it is reference data — so
   * this has to tolerate a row left by an earlier test in the same file.
   */
  const [inserted] = await db
    .insert(plans)
    .values({ name: PLAN_NAME, stripePriceId: PRICE })
    .onConflictDoNothing()
    .returning();

  const [plan] = inserted
    ? [inserted]
    : await db.select().from(plans).where(eq(plans.name, PLAN_NAME));

  specPrecondition(plan !== undefined, "could not seed the billing plan");

  return { accountId: account.id, planId: plan.id };
};

beforeEach(async () => {
  await requireDbOrFail();
  await cleanDatabase();
});

describe("F10 Stripe reconciliation is identity-aware", () => {
  test("deleting an OLD subscription leaves the current one active", async () => {
    const { accountId } = await seedBillingFixture();
    const billing = getBillingService();

    // The account moves from an old subscription to a new one.
    await billing.handleWebhookEvent(
      await customerSubscriptionUpdatedEvent(
        "evt_upd_old",
        subscriptionPayload(OLD_SUB, 1_000),
        1_000
      )
    );
    await billing.handleWebhookEvent(
      await customerSubscriptionUpdatedEvent(
        "evt_upd_new",
        subscriptionPayload(NEW_SUB, 2_000),
        2_000
      )
    );

    const [beforePlan] = await currentPlan(accountId);

    specPrecondition(
      beforePlan !== undefined,
      "reconciliation wrote no plan row; is the fixture price seeded?"
    );

    /*
     * Establish the starting state explicitly. Without this the assertions
     * below can be satisfied by an empty table, which is exactly how an
     * earlier version of this test reported a pass while reconciliation was
     * silently returning early.
     */
    specPrecondition(
      beforePlan.stripeSubscriptionId === NEW_SUB,
      "expected the newer subscription to be current before the deletion, " +
        `got ${beforePlan.stripeSubscriptionId ?? "none"}`
    );
    specPrecondition(
      beforePlan.status === "active",
      `expected the current plan to be active, got ${beforePlan.status}`
    );

    /*
     * The delayed cancellation of the OLD subscription arrives last, which is
     * ordinary Stripe behaviour after a retry.
     */
    await billing.handleWebhookEvent(
      await customerSubscriptionDeletedEvent(
        "evt_del_old",
        subscriptionPayload(OLD_SUB, 1_000),
        3_000
      )
    );

    const after = await currentPlan(accountId);

    /*
     * Status is the assertion that matters. The deletion path keeps the row
     * and its subscription id and only flips `status`, so checking the id
     * alone would pass against the defect.
     */
    expect(after[0]?.stripeSubscriptionId).toBe(NEW_SUB);
    expect(after[0]?.status).toBe("active");
  });

  test("control: deleting the CURRENT subscription cancels it", async () => {
    const { accountId } = await seedBillingFixture();
    const billing = getBillingService();

    await billing.handleWebhookEvent(
      await customerSubscriptionUpdatedEvent(
        "evt_upd_cur",
        subscriptionPayload(NEW_SUB, 1_000),
        1_000
      )
    );
    await billing.handleWebhookEvent(
      await customerSubscriptionDeletedEvent(
        "evt_del_cur",
        subscriptionPayload(NEW_SUB, 1_000),
        2_000
      )
    );

    const after = await currentPlan(accountId);

    /*
     * The service marks the plan canceled and leaves revocation to the
     * maintenance sweeper, so the row is still present and unrevoked. This
     * documents that contract and proves the fixture drives reconciliation
     * for real.
     */
    expect(after[0]?.stripeSubscriptionId).toBe(NEW_SUB);
    expect(after[0]?.status).toBe("canceled");
  });

  test("checkout completion records the subscription it was given", async () => {
    const { accountId, planId } = await seedBillingFixture();
    const billing = getBillingService();

    /*
     * The session names its subscription, so a correct implementation has
     * everything it needs. Omitting it and then demanding the id back would
     * make the assertion unreachable rather than merely unmet — no
     * implementation could satisfy it.
     */
    await billing.handleWebhookEvent(
      await checkoutSessionCompletedEvent(
        "evt_checkout_f10",
        {
          customer: CUSTOMER,
          subscription: NEW_SUB,
          metadata: { accountId, planId: String(planId) },
        },
        1_000
      )
    );

    const [afterCheckout] = await currentPlan(accountId);

    specPrecondition(
      afterCheckout !== undefined,
      "checkout wrote no plan row at all"
    );

    /*
     * `getSubscription` reports `hasStripeSubscription: false` while this is
     * empty (`billing.service.ts:137,144`), so the account looks unsubscribed
     * to the API immediately after paying.
     */
    expect(afterCheckout.stripeSubscriptionId).toBe(NEW_SUB);
  });

  /*
   * The two deliveries below carry the same `created` second, so the ordering
   * guard (`shouldSkipStaleStripeEvent`, `billing.service.ts:55-66`) is a
   * strict `>` that skips neither: both apply and the last one wins. Which
   * one is last is a delivery-order accident, so both orders have to be
   * specified — asserting only the forward one would let a fix that merely
   * retains the checkout's subscription id look complete while the reverse
   * order still erases the period and status written by the subscription
   * event.
   *
   * `expectComplete` is the same end state for every order: the account paid,
   * so the row must name the subscription, be active, and carry a period.
   * Without a period the downgrade sweeper can never revoke it, since it
   * filters on `isNotNull(currentPeriodEnd)`
   * (`account-maintenance.jobs.ts:87`), and the row is unsweepable for good.
   */
  const expectComplete = async (accountId: string): Promise<void> => {
    const [converged] = await currentPlan(accountId);

    specPrecondition(converged !== undefined, "no plan row after both events");

    expect(converged.stripeSubscriptionId).toBe(NEW_SUB);
    expect(converged.status).toBe("active");
    expect(converged.currentPeriodEnd).not.toBeNull();
  };

  const checkout = async (
    suffix: string,
    createdAt: number,
    ids: IBillingFixture
  ) =>
    getBillingService().handleWebhookEvent(
      await checkoutSessionCompletedEvent(
        `evt_checkout_${suffix}`,
        {
          customer: CUSTOMER,
          subscription: NEW_SUB,
          metadata: {
            accountId: ids.accountId,
            planId: String(ids.planId),
          },
        },
        createdAt
      )
    );

  const subscriptionUpdated = async (suffix: string, createdAt: number) =>
    getBillingService().handleWebhookEvent(
      await customerSubscriptionUpdatedEvent(
        `evt_upd_${suffix}`,
        subscriptionPayload(NEW_SUB, createdAt),
        createdAt
      )
    );

  test("a checkout row converges once the subscription event arrives", async () => {
    const ids = await seedBillingFixture();

    await checkout("fwd", 1_000, ids);
    await subscriptionUpdated("fwd", 1_000);

    await expectComplete(ids.accountId);
  });

  test("a same-second checkout does not erase the subscription event before it", async () => {
    const ids = await seedBillingFixture();

    await subscriptionUpdated("rev", 1_000);
    await checkout("rev", 1_000, ids);

    /*
     * The destructive direction. Checkout revokes the current plan
     * (`billing.service.ts:406-414`) and writes a row with no subscription
     * id and no period, so arriving second it discards everything the
     * subscription event established.
     */
    await expectComplete(ids.accountId);
  });

  /*
   * Non-active states, the ones that matter. Checkout completion is not a
   * statement about whether the subscription is paid, so it must not
   * promote a delinquent or ended subscription back to active — and the
   * two events routinely share a `created` second, so which arrives last
   * is a delivery accident rather than a signal.
   */
  for (const status of ["unpaid", "past_due", "canceled", "trialing"]) {
    test(`a same-second checkout does not overturn a '${status}' subscription`, async () => {
      const ids = await seedBillingFixture();
      const billing = getBillingService();

      await billing.handleWebhookEvent(
        await customerSubscriptionUpdatedEvent(
          `evt_upd_${status}`,
          subscriptionPayload(NEW_SUB, 1_000, status),
          1_000
        )
      );

      const [before] = await currentPlan(ids.accountId);

      specPrecondition(
        before?.status === status,
        `expected the row to be ${status} before checkout, got ${String(
          before?.status
        )}`
      );

      await checkout(`over_${status}`, 1_000, ids);

      const [after] = await currentPlan(ids.accountId);

      specPrecondition(after !== undefined, "no plan row after checkout");

      expect(after.status).toBe(status);
    });
  }

  test("a delayed checkout does not erase newer subscription state", async () => {
    const ids = await seedBillingFixture();

    await subscriptionUpdated("late", 1_000);

    /*
     * A retried checkout delivered a second later is not stale by the
     * `created` guard, so it applies in full. This is the ordinary Stripe
     * retry, not a contrived interleaving.
     */
    await checkout("late", 2_000, ids);

    await expectComplete(ids.accountId);
  });
});
