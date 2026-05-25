import { and, eq, isNull } from "drizzle-orm";
import Stripe from "stripe";

import { db } from "../../clients/postgres";
import {
  accountPlans,
  accounts,
  plans,
  stripeWebhookEvents,
} from "../../clients/postgres/schema";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { AUDIT_ACTIONS, auditLogService } from "../../lib/audit-log";
import { ApiErrors, getErrorMessage } from "../../lib/errors";
import { now } from "../../lib/time/now";

import type {
  ICheckoutSessionResult,
  IPlanSummary,
  IPortalSessionResult,
  ISubscriptionSummary,
} from "./billing.types";
import { assertAllowedBillingRedirectUrl } from "./billing.utils";

const STRIPE_STATUS_MAP: Record<string, string> = {
  active: "active",
  trialing: "trialing",
  past_due: "past_due",
  unpaid: "unpaid",
  paused: "paused",
  canceled: "canceled",
  incomplete: "incomplete",
  incomplete_expired: "canceled",
};

const mapStripeStatus = (stripeStatus: string): string =>
  STRIPE_STATUS_MAP[stripeStatus] ?? "incomplete";

type BillingTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface IStripeEventSnapshot {
  readonly lastStripeEventAt: string | null;
  readonly lastStripeEventId: string | null;
}

interface IStripeWebhookDetails {
  readonly eventId: string;
  readonly eventType: string;
  readonly eventCreated: number;
}

const stripeEventOccurredAt = (eventCreated: number): string =>
  new Date(eventCreated * 1000).toISOString();

const isOlderStripeEvent = (
  current: IStripeEventSnapshot | undefined,
  eventCreated: number
): boolean => {
  const lastEventAt = current?.lastStripeEventAt;

  if (lastEventAt === undefined || lastEventAt === null) {
    return false;
  }

  return Date.parse(lastEventAt) > eventCreated * 1000;
};

export class BillingService {
  private readonly stripe: Stripe;

  constructor() {
    if (env.STRIPE_SECRET_KEY === "") {
      throw ApiErrors.internal(
        "BillingService instantiated without STRIPE_SECRET_KEY"
      );
    }

    this.stripe = new Stripe(env.STRIPE_SECRET_KEY);
  }

  async listPlans(): Promise<IPlanSummary[]> {
    await this.ensureConfiguredPlans();

    const rows = await db.query.plans.findMany({ orderBy: [plans.name] });

    return rows.map((plan) => ({
      id: plan.id,
      name: plan.name,
      isDefault: plan.isDefault,
    }));
  }

  async getSubscription(accountId: string): Promise<ISubscriptionSummary> {
    await this.ensureConfiguredPlans();

    const [accountPlan, defaultPlan] = await Promise.all([
      db.query.accountPlans.findFirst({
        where: and(
          eq(accountPlans.accountId, accountId),
          isNull(accountPlans.revokedAt)
        ),
      }),
      db.query.plans.findFirst({ where: eq(plans.isDefault, true) }),
    ]);

    if (defaultPlan === undefined) {
      throw ApiErrors.internal("Default billing plan is not configured");
    }

    if (accountPlan === undefined) {
      return {
        planId: defaultPlan.id,
        planName: defaultPlan.name,
        isDefault: true,
        status: "free",
        hasStripeSubscription: false,
      };
    }

    const plan = await db.query.plans.findFirst({
      where: eq(plans.id, accountPlan.planId),
    });

    if (plan === undefined) {
      throw ApiErrors.internal("Account plan references a missing plan row");
    }

    const stripeSubscriptionId = accountPlan.stripeSubscriptionId ?? "";

    return {
      planId: plan.id,
      planName: plan.name,
      isDefault: plan.isDefault,
      status: accountPlan.status,
      hasStripeSubscription: stripeSubscriptionId !== "",
    };
  }

  async createCheckoutSession(
    planId: number,
    accountId: string,
    actorUserId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<ICheckoutSessionResult> {
    assertAllowedBillingRedirectUrl(successUrl, "successUrl");
    assertAllowedBillingRedirectUrl(cancelUrl, "cancelUrl");
    await this.ensureConfiguredPlans();

    const [plan, account] = await Promise.all([
      db.query.plans.findFirst({ where: eq(plans.id, planId) }),
      db.query.accounts.findFirst({ where: eq(accounts.id, accountId) }),
    ]);

    if (!plan) {
      throw ApiErrors.notFound("Plan");
    }

    if (!account) {
      throw ApiErrors.notFound("Account");
    }

    if (plan.stripePriceId === "") {
      throw ApiErrors.internal("Plan is missing a Stripe Price ID");
    }

    let stripeCustomerId = account.stripeCustomerId;

    if (stripeCustomerId === null || stripeCustomerId === "") {
      const customer = await this.stripe.customers.create({
        name: account.name,
        metadata: { accountId: account.id },
      });

      stripeCustomerId = customer.id;

      await db
        .update(accounts)
        .set({ stripeCustomerId })
        .where(eq(accounts.id, accountId));
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        planId: String(plan.id),
        accountId: account.id,
      },
    });

    if (session.url === null) {
      throw ApiErrors.internal("Stripe did not return a checkout URL");
    }

    void auditLogService.record({
      userId: actorUserId,
      action: AUDIT_ACTIONS.BILLING_CHECKOUT_SESSION_CREATED,
      metadata: { planId: plan.id, sessionId: session.id, accountId },
    });

    return { url: session.url };
  }

  private async ensureConfiguredPlans(): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .insert(plans)
        .values({
          name: "Free",
          isDefault: true,
          stripePriceId: env.STRIPE_PRICE_ID_FREE,
        })
        .onConflictDoUpdate({
          target: plans.name,
          set: {
            isDefault: true,
            stripePriceId: env.STRIPE_PRICE_ID_FREE,
          },
        });

      await tx
        .insert(plans)
        .values({
          name: "Pro",
          isDefault: false,
          stripePriceId: env.STRIPE_PRICE_ID_PRO,
        })
        .onConflictDoUpdate({
          target: plans.name,
          set: {
            isDefault: false,
            stripePriceId: env.STRIPE_PRICE_ID_PRO,
          },
        });
    });
  }

  private async ensureIdempotent(
    tx: BillingTransaction,
    eventId: string,
    eventType: string
  ): Promise<boolean> {
    const [claimed] = await tx
      .insert(stripeWebhookEvents)
      .values({ eventId, type: eventType })
      .onConflictDoNothing({ target: stripeWebhookEvents.eventId })
      .returning({ eventId: stripeWebhookEvents.eventId });

    if (!claimed) {
      logger.info("Skipping already-processed Stripe event", {
        event: "billing.webhook.duplicate_event",
        eventId,
        type: eventType,
      });

      return false;
    }

    return true;
  }

  private async findCurrentPlanSnapshot(
    tx: BillingTransaction,
    accountId: string
  ): Promise<IStripeEventSnapshot | undefined> {
    return tx.query.accountPlans.findFirst({
      columns: {
        lastStripeEventAt: true,
        lastStripeEventId: true,
      },
      where: and(
        eq(accountPlans.accountId, accountId),
        isNull(accountPlans.revokedAt)
      ),
    });
  }

  private async shouldSkipStaleStripeEvent(
    tx: BillingTransaction,
    accountId: string,
    details: IStripeWebhookDetails
  ): Promise<boolean> {
    const current = await this.findCurrentPlanSnapshot(tx, accountId);

    if (!isOlderStripeEvent(current, details.eventCreated)) {
      return false;
    }

    logger.info("Skipping stale Stripe event", {
      event: "billing.webhook.stale_event",
      accountId,
      eventId: details.eventId,
      type: details.eventType,
      previousEventId: current?.lastStripeEventId ?? undefined,
      previousEventAt: current?.lastStripeEventAt ?? undefined,
      receivedEventAt: stripeEventOccurredAt(details.eventCreated),
    });

    return true;
  }

  private async handleCheckoutSessionCompleted(
    tx: BillingTransaction,
    session: Stripe.Checkout.Session,
    details: IStripeWebhookDetails
  ): Promise<void> {
    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : (session.customer?.id ?? "");
    const accountId = session.metadata?.accountId;
    const planIdRaw = session.metadata?.planId;

    if (
      customerId === "" ||
      accountId === undefined ||
      planIdRaw === undefined
    ) {
      logger.warn("Missing metadata in checkout.session.completed", {
        event: "billing.webhook.missing_metadata",
        customerId,
        accountId,
        planIdRaw,
      });

      return;
    }

    const planId = parseInt(planIdRaw, 10);

    if (Number.isNaN(planId)) {
      return;
    }

    if (await this.shouldSkipStaleStripeEvent(tx, accountId, details)) {
      return;
    }

    await tx
      .update(accountPlans)
      .set({ revokedAt: now() })
      .where(
        and(
          eq(accountPlans.accountId, accountId),
          isNull(accountPlans.revokedAt)
        )
      );

    await tx.insert(accountPlans).values({
      accountId,
      planId,
      status: "active",
      source: "stripe",
      lastStripeEventId: details.eventId,
      lastStripeEventAt: stripeEventOccurredAt(details.eventCreated),
    });

    logger.info("Account plan updated", {
      event: "billing.user_plan.updated",
      accountId,
      planId,
    });
  }

  private async handleSubscriptionUpsert(
    tx: BillingTransaction,
    subscription: Stripe.Subscription,
    details: IStripeWebhookDetails
  ): Promise<void> {
    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id;
    const newPriceId = subscription.items.data[0]?.price.id;

    if (newPriceId === undefined) {
      return;
    }

    const [account, newPlan] = await Promise.all([
      tx.query.accounts.findFirst({
        where: eq(accounts.stripeCustomerId, customerId),
      }),
      tx.query.plans.findFirst({
        where: eq(plans.stripePriceId, newPriceId),
      }),
    ]);

    if (!account || !newPlan) {
      return;
    }

    if (await this.shouldSkipStaleStripeEvent(tx, account.id, details)) {
      return;
    }

    const periodEnd = subscription.items.data[0]?.current_period_end ?? null;
    const currentPeriodEnd =
      periodEnd === null ? null : new Date(periodEnd * 1000).toISOString();

    await tx
      .update(accountPlans)
      .set({ revokedAt: now() })
      .where(
        and(
          eq(accountPlans.accountId, account.id),
          isNull(accountPlans.revokedAt)
        )
      );

    await tx.insert(accountPlans).values({
      accountId: account.id,
      planId: newPlan.id,
      status: mapStripeStatus(subscription.status),
      currentPeriodEnd,
      source: "stripe",
      stripeSubscriptionId: subscription.id,
      stripeSubscriptionCreatedAt: new Date(
        subscription.created * 1000
      ).toISOString(),
      lastStripeEventId: details.eventId,
      lastStripeEventAt: stripeEventOccurredAt(details.eventCreated),
    });
  }

  private async handleSubscriptionDeleted(
    tx: BillingTransaction,
    subscription: Stripe.Subscription,
    details: IStripeWebhookDetails
  ): Promise<void> {
    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id;

    const account = await tx.query.accounts.findFirst({
      where: eq(accounts.stripeCustomerId, customerId),
    });

    if (!account) {
      return;
    }

    if (await this.shouldSkipStaleStripeEvent(tx, account.id, details)) {
      return;
    }

    await tx
      .update(accountPlans)
      .set({
        status: "canceled",
        lastStripeEventId: details.eventId,
        lastStripeEventAt: stripeEventOccurredAt(details.eventCreated),
      })
      .where(
        and(
          eq(accountPlans.accountId, account.id),
          isNull(accountPlans.revokedAt)
        )
      );
  }

  async createPortalSession(
    accountId: string,
    actorUserId: string,
    returnUrl: string
  ): Promise<IPortalSessionResult> {
    assertAllowedBillingRedirectUrl(returnUrl, "returnUrl");

    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    });
    const stripeCustomerId = account?.stripeCustomerId;

    if (
      stripeCustomerId === undefined ||
      stripeCustomerId === null ||
      stripeCustomerId === ""
    ) {
      throw ApiErrors.notFound("Stripe customer for account");
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    void auditLogService.record({
      userId: actorUserId,
      action: AUDIT_ACTIONS.BILLING_PORTAL_SESSION_CREATED,
      metadata: { sessionId: session.id, accountId },
    });

    return { url: session.url };
  }

  async constructWebhookEvent(
    payload: string,
    signature: string
  ): Promise<Stripe.Event> {
    if (env.STRIPE_WEBHOOK_SECRET === "") {
      throw ApiErrors.internal("STRIPE_WEBHOOK_SECRET not configured");
    }

    try {
      return await this.stripe.webhooks.constructEventAsync(
        payload,
        signature,
        env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err: unknown) {
      throw ApiErrors.validation(
        `Webhook signature error: ${getErrorMessage(err)}`
      );
    }
  }

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    await db.transaction(async (tx) => {
      const claimed = await this.ensureIdempotent(tx, event.id, event.type);
      const details: IStripeWebhookDetails = {
        eventId: event.id,
        eventType: event.type,
        eventCreated: event.created,
      };

      if (!claimed) {
        return;
      }

      switch (event.type) {
        case "checkout.session.completed": {
          await this.handleCheckoutSessionCompleted(
            tx,
            event.data.object,
            details
          );

          return;
        }

        case "customer.subscription.created":

        // falls through
        case "customer.subscription.updated": {
          /*
           * Both events take the same path: persist whatever Stripe says
           * is now true about the subscription. `created` is the
           * direct-API counterpart of `checkout.session.completed`.
           */
          await this.handleSubscriptionUpsert(tx, event.data.object, details);

          return;
        }

        case "customer.subscription.deleted": {
          await this.handleSubscriptionDeleted(tx, event.data.object, details);

          return;
        }

        default:
          logger.debug("Unhandled Stripe event type", {
            event: "billing.webhook.unhandled_type",
            type: event.type,
          });
      }
    });
  }
}

let billingServiceInstance: BillingService | null = null;

export const getBillingService = (): BillingService => {
  if (!env.BILLING_ENABLED) {
    throw ApiErrors.notFound("Billing is not enabled");
  }

  billingServiceInstance ??= new BillingService();

  return billingServiceInstance;
};
