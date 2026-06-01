import Stripe from "stripe";

import { env } from "../../src/config/env";

/*
 * Test-only fixture builders. Round-trip a JSON payload through Stripe's
 * own `generateTestHeaderStringAsync` + `constructEventAsync` so the
 * returned value IS a real `Stripe.Event` — no type assertions, no
 * partial-shape casts. The signature/verify pair is also exercised on
 * the way through, which is the same code path production uses.
 */
const buildTestEvent = async (
  id: string,
  type: string,
  object: unknown,
  eventCreated = 0
): Promise<Stripe.Event> => {
  const payload = JSON.stringify({
    id,
    type,
    object: "event",
    api_version: "2020-08-27",
    created: eventCreated,
    livemode: false,
    pending_webhooks: 0,
    request: null,
    data: { object },
  });
  const signature = await Stripe.webhooks.generateTestHeaderStringAsync({
    payload,
    secret: env.STRIPE_WEBHOOK_SECRET,
  });

  return Stripe.webhooks.constructEventAsync(
    payload,
    signature,
    env.STRIPE_WEBHOOK_SECRET
  );
};

/** Minimal fields the billing service reads from `checkout.session.completed`. */
export const checkoutSessionCompletedEvent = (
  id: string,
  session: { customer: string; metadata?: Record<string, string> },
  eventCreated?: number
): Promise<Stripe.Event> =>
  buildTestEvent(id, "checkout.session.completed", session, eventCreated);

/** Minimal fields the billing service reads from `customer.subscription.updated`. */
export const customerSubscriptionUpdatedEvent = (
  id: string,
  subscription: {
    id: string;
    customer: string;
    status: Stripe.Subscription.Status;
    created: number;
    items: {
      data: {
        price: { id: string };
        current_period_end: number;
      }[];
    };
  },
  eventCreated?: number
): Promise<Stripe.Event> =>
  buildTestEvent(
    id,
    "customer.subscription.updated",
    subscription,
    eventCreated
  );
