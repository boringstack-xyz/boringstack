import { and, eq, isNull, notInArray, or } from "drizzle-orm";
import Stripe from "stripe";

import { db } from "../../clients/postgres";
import {
  accountPlans,
  accounts,
  planFeatures,
  plans,
  stripeWebhookEvents,
} from "../../clients/postgres/schema";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { FEATURE_KEYS } from "../../lib/acl/acl.constants";
import { AUDIT_ACTIONS, auditLogService } from "../../lib/audit-log";
import { ApiErrors, getErrorMessage } from "../../lib/errors";
import { now } from "../../lib/time/now";

import {
  BILLING_INTERVALS,
  CHECKOUT_SESSION_MODE,
  CHECKOUT_SESSION_OPEN,
  DEFAULT_BILLING_INTERVAL,
  STRIPE_LIST_PAGE_SIZE,
  SUBSCRIPTION_CONFLICT_MESSAGE,
  TERMINAL_SUBSCRIPTION_STATUSES,
} from "./billing.constants";
import type { IPlanPriceIds } from "./billing.plans";
import { buildBuiltInPlans, findPlanNameByPriceId } from "./billing.plans";
import type {
  AccountPlanStatus,
  BillingInterval,
  ICheckoutSessionResult,
  IPlanSummary,
  IPortalSessionResult,
  ISubscriptionSummary,
} from "./billing.types";
import { assertAllowedBillingRedirectUrl } from "./billing.utils";

const STRIPE_STATUS_MAP: Record<string, AccountPlanStatus> = {
  active: "active",
  trialing: "trialing",
  past_due: "past_due",
  unpaid: "unpaid",
  paused: "paused",
  canceled: "canceled",
  incomplete: "incomplete",
  incomplete_expired: "canceled",
};

const mapStripeStatus = (stripeStatus: string): AccountPlanStatus =>
  STRIPE_STATUS_MAP[stripeStatus] ?? "incomplete";

const terminalStatuses: readonly string[] = TERMINAL_SUBSCRIPTION_STATUSES;

const isLiveSubscriptionStatus = (status: string): boolean =>
  !terminalStatuses.includes(status);

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

/*
 * Injected for tests. Production leaves both unset: the client is built on
 * first use, so reading plans or constructing the service never needs a
 * Stripe key, and settings are read from env at call time.
 */
export interface IBillingServiceOptions {
  readonly stripe?: Stripe;
  readonly settings?: IBillingSettings;
}

export interface IBillingSettings {
  readonly enabled: boolean;
  readonly priceIds: IPlanPriceIds;
}

const currentBillingSettings = (): IBillingSettings => ({
  enabled: env.BILLING_ENABLED,
  priceIds: {
    free: env.STRIPE_PRICE_ID_FREE,
    proMonthly: env.STRIPE_PRICE_ID_PRO,
    proYearly: env.STRIPE_PRICE_ID_PRO_YEARLY,
  },
});

const stripeEventOccurredAt = (eventCreated: number): string =>
  new Date(eventCreated * 1000).toISOString();

const isOlderStripeEvent = (
  current: IStripeEventSnapshot | undefined,
  eventCreated: number
): boolean => {
  const lastEventAt = current?.lastStripeEventAt;

  return lastEventAt === undefined || lastEventAt === null
    ? false
    : Date.parse(lastEventAt) > eventCreated * 1000;
};

const STRIPE_REQUEST_TIMEOUT_MS = 10_000;

const createStripeClient = (): Stripe => {
  if (env.STRIPE_SECRET_KEY === "") {
    throw ApiErrors.internal(
      "BillingService instantiated without STRIPE_SECRET_KEY"
    );
  }

  /*
   * Explicit budget: the SDK's implicit 80s default would hold
   * checkout/portal request handlers hostage to a slow Stripe API.
   * The SDK retries idempotent calls internally, so each attempt
   * gets this budget.
   */
  return new Stripe(env.STRIPE_SECRET_KEY, {
    timeout: STRIPE_REQUEST_TIMEOUT_MS,
  });
};

const priceForPlan = (
  settings: IBillingSettings,
  planName: string,
  interval: BillingInterval
): string =>
  buildBuiltInPlans(settings.priceIds).find((plan) => plan.name === planName)
    ?.prices[interval] ?? "";

/*
 * Seeds the built-in plan rows and their feature values. Idempotent: rows are
 * upserted by natural key, and the catalog in billing.plans.ts is the source of
 * truth, so a hand-edit to a built-in plan is overwritten on the next call.
 */
const ensureConfiguredPlans = async (
  settings: IBillingSettings
): Promise<void> => {
  const catalog = buildBuiltInPlans(settings.priceIds);

  await db.transaction(async (tx) => {
    for (const definition of catalog) {
      const [row] = await tx
        .insert(plans)
        .values({
          name: definition.name,
          isDefault: definition.isDefault,
          stripePriceId: definition.prices.month,
        })
        .onConflictDoUpdate({
          target: plans.name,
          set: {
            isDefault: definition.isDefault,
            stripePriceId: definition.prices.month,
          },
        })
        .returning({ id: plans.id });

      if (row === undefined) {
        throw ApiErrors.internal("Built-in plan row could not be resolved");
      }

      const assignedKeys = FEATURE_KEYS.filter(
        (featureKey) => definition.features[featureKey] !== undefined
      );

      for (const featureKey of assignedKeys) {
        const value = definition.features[featureKey];

        await tx
          .insert(planFeatures)
          .values({ planId: row.id, featureKey, value })
          .onConflictDoUpdate({
            target: [planFeatures.planId, planFeatures.featureKey],
            set: { value },
          });
      }

      /*
       * Stored rows for keys the catalog does not assign are removed, so a
       * built-in plan's features always match billing.plans.ts.
       */
      await tx
        .delete(planFeatures)
        .where(
          and(
            eq(planFeatures.planId, row.id),
            notInArray(planFeatures.featureKey, assignedKeys)
          )
        );
    }
  });
};

const purchasableIntervalsFor = (
  settings: IBillingSettings,
  planName: string,
  isDefault: boolean
): BillingInterval[] => {
  const definition = buildBuiltInPlans(settings.priceIds).find(
    (plan) => plan.name === planName
  );

  return !settings.enabled || isDefault || definition === undefined
    ? []
    : BILLING_INTERVALS.filter(
        (interval) => definition.prices[interval] !== ""
      );
};

/*
 * Public: this is the pricing-page read. It touches only the database and the
 * env-derived catalog, never the Stripe client, and it answers even when
 * billing is disabled (in which case no interval is purchasable).
 */
export const listBillingPlans = async (
  settings: IBillingSettings = currentBillingSettings()
): Promise<IPlanSummary[]> => {
  await ensureConfiguredPlans(settings);

  const rows = await db.query.plans.findMany({ orderBy: [plans.name] });

  return rows.map((plan) => ({
    id: plan.id,
    name: plan.name,
    isDefault: plan.isDefault,
    purchasableIntervals: purchasableIntervalsFor(
      settings,
      plan.name,
      plan.isDefault
    ),
  }));
};

const isPaidCheckout = (session: Stripe.Checkout.Session): boolean =>
  session.payment_status === "paid" ||
  session.payment_status === "no_payment_required";

/*
 * Status a checkout event implies for the account's subscription row.
 * `unpaid` (delayed payment methods such as bank debit) must not entitle
 * until the async success event arrives.
 */
const checkoutStatusFor = (
  eventType: string,
  session: Stripe.Checkout.Session
): AccountPlanStatus => {
  switch (eventType) {
    case "checkout.session.async_payment_succeeded":
      return "active";
    case "checkout.session.async_payment_failed":
      return "incomplete";
    default:
      return isPaidCheckout(session) ? "active" : "incomplete";
  }
};

export class BillingService {
  private stripeClient: Stripe | undefined;
  private readonly settings: IBillingSettings;

  constructor(options: IBillingServiceOptions = {}) {
    this.stripeClient = options.stripe;
    this.settings = options.settings ?? currentBillingSettings();
  }

  private get stripe(): Stripe {
    this.stripeClient ??= createStripeClient();

    return this.stripeClient;
  }

  listPlans(): Promise<IPlanSummary[]> {
    return listBillingPlans(this.settings);
  }

  async getSubscription(accountId: string): Promise<ISubscriptionSummary> {
    await ensureConfiguredPlans(this.settings);

    const [accountPlan, defaultPlan] = await Promise.all([
      /*
       * Eager-load the related plan in the same round-trip via the
       * accountPlans→plan relation instead of a follow-up findFirst.
       */
      db.query.accountPlans.findFirst({
        where: and(
          eq(accountPlans.accountId, accountId),
          isNull(accountPlans.revokedAt)
        ),
        with: { plan: true },
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

    // plan is guaranteed by the not-null account_plans_plan_id_fkey FK.
    const plan = accountPlan.plan;
    const stripeSubscriptionId = accountPlan.stripeSubscriptionId ?? "";

    return {
      planId: plan.id,
      planName: plan.name,
      isDefault: plan.isDefault,
      status: accountPlan.status,
      hasStripeSubscription: stripeSubscriptionId !== "",
    };
  }

  /**
   * Starts (or reuses) a Stripe Checkout session for one plan and interval.
   *
   * The account row is locked for the whole sequence, so two quick clicks
   * serialize: the second request waits, then finds the first request's
   * open session on Stripe and returns its URL instead of creating another.
   * A live subscription, from either the local row or Stripe itself (the
   * webhook may not have landed yet), rejects the request with a conflict.
   */
  async createCheckoutSession(
    planId: number,
    accountId: string,
    actorUserId: string,
    successUrl: string,
    cancelUrl: string,
    interval: BillingInterval = DEFAULT_BILLING_INTERVAL
  ): Promise<ICheckoutSessionResult> {
    assertAllowedBillingRedirectUrl(successUrl, "successUrl");
    assertAllowedBillingRedirectUrl(cancelUrl, "cancelUrl");
    await ensureConfiguredPlans(this.settings);

    const plan = await db.query.plans.findFirst({
      where: eq(plans.id, planId),
    });

    if (!plan) {
      throw ApiErrors.notFound("Plan");
    }

    if (plan.isDefault) {
      throw ApiErrors.invalidInput("Choose a paid subscription plan", "planId");
    }

    const priceId = priceForPlan(this.settings, plan.name, interval);

    if (priceId === "") {
      throw ApiErrors.invalidInput(
        "This billing interval is not available for the plan",
        "interval"
      );
    }

    return db.transaction(async (tx) => {
      const [account] = await tx
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, accountId), isNull(accounts.deletedAt)))
        .for("update");

      if (account === undefined) {
        throw ApiErrors.notFound("Account");
      }

      const localSubscription = await tx.query.accountPlans.findFirst({
        where: and(
          eq(accountPlans.accountId, accountId),
          isNull(accountPlans.revokedAt)
        ),
      });

      /*
       * Only a Stripe-backed row blocks checkout: an admin grant or a test
       * fixture plan has no subscription to manage, and buying replaces it.
       */
      if (
        localSubscription !== undefined &&
        (localSubscription.stripeSubscriptionId ?? "") !== "" &&
        isLiveSubscriptionStatus(localSubscription.status)
      ) {
        throw ApiErrors.conflict(SUBSCRIPTION_CONFLICT_MESSAGE);
      }

      const stripeCustomerId = await this.ensureStripeCustomer(tx, account);

      await this.assertNoLiveStripeSubscription(stripeCustomerId);

      const reusableUrl = await this.findReusableCheckoutUrl(
        stripeCustomerId,
        accountId,
        plan.id,
        priceId
      );

      if (reusableUrl !== null) {
        return { url: reusableUrl };
      }

      const session = await this.stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: CHECKOUT_SESSION_MODE,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          planId: String(plan.id),
          priceId,
          accountId: account.id,
        },
      });

      if (session.url === null) {
        throw ApiErrors.internal("Stripe did not return a checkout URL");
      }

      void auditLogService.record({
        userId: actorUserId,
        action: AUDIT_ACTIONS.BILLING_CHECKOUT_SESSION_CREATED,
        targetAccountId: accountId,
        metadata: {
          planId: plan.id,
          sessionId: session.id,
          accountId,
          interval,
        },
      });

      return { url: session.url };
    });
  }

  private async ensureStripeCustomer(
    tx: BillingTransaction,
    account: typeof accounts.$inferSelect
  ): Promise<string> {
    const existing = account.stripeCustomerId;

    if (existing !== null && existing !== "") {
      return existing;
    }

    /*
     * Idempotency key keyed on the account id makes Stripe collapse a
     * double-click into a single customer record. Without it, two
     * parallel checkout requests each see `stripeCustomerId === null`,
     * each `customers.create()` returns a *different* id, and the
     * second DB write wins: the orphaned customer's future webhook
     * deliveries don't resolve the account and the subscription
     * silently lands on the wrong tenant. Stripe holds the key for
     * 24h, which covers any plausible double-submit window.
     */
    const customer = await this.stripe.customers.create(
      {
        name: account.name,
        metadata: { accountId: account.id },
      },
      { idempotencyKey: `account-customer:${account.id}` }
    );

    /*
     * Conditional update: only write the customer id when the column is still
     * empty, so an existing value is never overwritten.
     */
    await tx
      .update(accounts)
      .set({ stripeCustomerId: customer.id })
      .where(
        and(
          eq(accounts.id, account.id),
          or(
            isNull(accounts.stripeCustomerId),
            eq(accounts.stripeCustomerId, "")
          )
        )
      );

    return customer.id;
  }

  private async assertNoLiveStripeSubscription(
    stripeCustomerId: string
  ): Promise<void> {
    for await (const subscription of this.stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: "all",
      limit: STRIPE_LIST_PAGE_SIZE,
    })) {
      if (isLiveSubscriptionStatus(subscription.status)) {
        throw ApiErrors.conflict(SUBSCRIPTION_CONFLICT_MESSAGE);
      }
    }
  }

  private async findReusableCheckoutUrl(
    stripeCustomerId: string,
    accountId: string,
    planId: number,
    priceId: string
  ): Promise<string | null> {
    for await (const session of this.stripe.checkout.sessions.list({
      customer: stripeCustomerId,
      status: CHECKOUT_SESSION_OPEN,
      limit: STRIPE_LIST_PAGE_SIZE,
    })) {
      if (
        session.mode === CHECKOUT_SESSION_MODE &&
        session.metadata?.accountId === accountId &&
        session.metadata.planId === String(planId) &&
        session.metadata.priceId === priceId &&
        session.url !== null
      ) {
        return session.url;
      }
    }

    return null;
  }

  async createPortalSession(
    accountId: string,
    actorUserId: string,
    returnUrl: string
  ): Promise<IPortalSessionResult> {
    assertAllowedBillingRedirectUrl(returnUrl, "returnUrl");

    const account = await db.query.accounts.findFirst({
      where: and(eq(accounts.id, accountId), isNull(accounts.deletedAt)),
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
      targetAccountId: accountId,
      metadata: { sessionId: session.id, accountId },
    });

    return { url: session.url };
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

  /*
   * Handles checkout.session.completed and the two async-payment events.
   *
   * Completion alone does not write status when the subscription row already
   * exists: `customer.subscription.*` is the authority there, and Stripe emits
   * both with the same `created` second. The async events are the exception,
   * since they are the only signal that a delayed payment settled or failed,
   * so they set the status on a matching row.
   *
   * Revoking the row and inserting a replacement discards the period, and a
   * row without `currentPeriodEnd` is permanently unsweepable, since the
   * downgrade job filters on `isNotNull(currentPeriodEnd)`. So a new row is
   * only inserted when no row exists for this subscription.
   */
  private async handleCheckoutSessionEvent(
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

    /*
     * Re-derive the account from the verified Stripe customer rather than
     * trusting session.metadata.accountId alone: the same cross-check
     * handleSubscriptionUpsert already performs. The metadata rides inside
     * a signature-verified event, so this is defense-in-depth: it catches a
     * mis-set/reassigned customer→account mapping before we mutate plans.
     */
    const account = await tx.query.accounts.findFirst({
      where: eq(accounts.stripeCustomerId, customerId),
    });

    if (account?.id !== accountId) {
      logger.warn("Checkout customer does not map to the metadata account", {
        event: "billing.webhook.account_mismatch",
        customerId,
        metadataAccountId: accountId,
        resolvedAccountId: account?.id ?? null,
      });

      return;
    }

    if (await this.shouldSkipStaleStripeEvent(tx, accountId, details)) {
      return;
    }

    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : (session.subscription?.id ?? null);

    const targetStatus = checkoutStatusFor(details.eventType, session);
    const isCompletion = details.eventType === "checkout.session.completed";

    const current = await tx.query.accountPlans.findFirst({
      where: and(
        eq(accountPlans.accountId, accountId),
        isNull(accountPlans.revokedAt)
      ),
    });

    if (
      current !== undefined &&
      subscriptionId !== null &&
      current.stripeSubscriptionId === subscriptionId
    ) {
      await tx
        .update(accountPlans)
        .set({
          ...(isCompletion ? {} : { status: targetStatus }),
          lastStripeEventId: details.eventId,
          lastStripeEventAt: stripeEventOccurredAt(details.eventCreated),
        })
        .where(
          and(
            eq(accountPlans.id, current.id),
            eq(accountPlans.accountId, accountId)
          )
        );

      if (!isCompletion) {
        this.recordReconciled(accountId, details, planId, targetStatus);
      }

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
      status: targetStatus,
      source: "stripe",
      /*
       * The session names its subscription. Dropping it makes
       * `getSubscription` report `hasStripeSubscription: false` for an
       * account that has just paid, and leaves the row with nothing for a
       * later subscription event to match on.
       */
      stripeSubscriptionId: subscriptionId,
      currentPeriodEnd: current?.currentPeriodEnd ?? null,
      lastStripeEventId: details.eventId,
      lastStripeEventAt: stripeEventOccurredAt(details.eventCreated),
    });

    logger.info("Account plan updated", {
      event: "billing.user_plan.updated",
      accountId,
      planId,
    });

    this.recordReconciled(accountId, details, planId, targetStatus);
  }

  private recordReconciled(
    accountId: string,
    details: IStripeWebhookDetails,
    planId: number | undefined,
    status: AccountPlanStatus
  ): void {
    void auditLogService.record({
      userId: null,
      action: AUDIT_ACTIONS.STRIPE_RECONCILED,
      resource: `account:${accountId}`,
      targetAccountId: accountId,
      metadata: {
        eventId: details.eventId,
        eventType: details.eventType,
        planId,
        status,
      },
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

    /*
     * The catalog maps every built-in price, including the yearly one that
     * plans.stripePriceId does not hold. Any other plan row (a tier a product
     * added outside the catalog) still matches on its own stripePriceId.
     */
    const planName = findPlanNameByPriceId(
      buildBuiltInPlans(this.settings.priceIds),
      newPriceId
    );

    const [account, newPlan] = await Promise.all([
      tx.query.accounts.findFirst({
        where: eq(accounts.stripeCustomerId, customerId),
      }),
      tx.query.plans.findFirst({
        where:
          planName === undefined
            ? eq(plans.stripePriceId, newPriceId)
            : eq(plans.name, planName),
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

    this.recordReconciled(
      account.id,
      details,
      newPlan.id,
      mapStripeStatus(subscription.status)
    );
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

    /*
     * Scoped to the subscription the event names. Cancelling "whatever is
     * current" lets a late `deleted` for an OLD subscription cancel the NEW
     * one, and cancel-then-resubscribe followed by a webhook retry produces
     * exactly that order. Stripe does not guarantee delivery order.
     */
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
          eq(accountPlans.stripeSubscriptionId, subscription.id),
          isNull(accountPlans.revokedAt)
        )
      );

    this.recordReconciled(account.id, details, undefined, "canceled");
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
        case "checkout.session.completed":

        // falls through
        case "checkout.session.async_payment_succeeded":

        // falls through
        case "checkout.session.async_payment_failed": {
          await this.handleCheckoutSessionEvent(tx, event.data.object, details);

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
