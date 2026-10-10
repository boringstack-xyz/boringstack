import Stripe from "stripe";

import { env } from "../../src/config/env";

/*
 * Test-only fixture builders. Round-trip a JSON payload through Stripe's
 * own `generateTestHeaderStringAsync` + `constructEventAsync` so the
 * returned value IS a real `Stripe.Event`: no type assertions, no
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

export interface ICheckoutSessionFixture {
  customer: string;
  metadata?: Record<string, string>;
  /** The subscription the checkout created, when there is one. */
  subscription?: string;
  /** Defaults to `paid`, the value a card checkout reports. */
  payment_status?: "paid" | "unpaid" | "no_payment_required";
}

export type CheckoutSessionEventType =
  | "checkout.session.completed"
  | "checkout.session.async_payment_succeeded"
  | "checkout.session.async_payment_failed";

/** Any of the three checkout events the billing service consumes. */
export const checkoutSessionEvent = (
  type: CheckoutSessionEventType,
  id: string,
  session: ICheckoutSessionFixture,
  eventCreated?: number
): Promise<Stripe.Event> =>
  buildTestEvent(
    id,
    type,
    { payment_status: "paid", ...session },
    eventCreated
  );

/** Minimal fields the billing service reads from `checkout.session.completed`. */
export const checkoutSessionCompletedEvent = (
  id: string,
  session: ICheckoutSessionFixture,
  eventCreated?: number
): Promise<Stripe.Event> =>
  checkoutSessionEvent("checkout.session.completed", id, session, eventCreated);

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

/** Minimal fields the billing service reads from `customer.subscription.deleted`. */
export const customerSubscriptionDeletedEvent = (
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
    "customer.subscription.deleted",
    subscription,
    eventCreated
  );

/*
 * A real `Stripe` client whose HTTP layer is a fake. The SDK still encodes the
 * request and parses the response, so the code under test uses the same
 * client type and parameter shapes as production, and nothing leaves the
 * process. Only the four endpoints the billing service calls are modelled.
 */
export interface IFakeStripeRequest {
  readonly method: string;
  readonly path: string;
  readonly params: URLSearchParams;
  readonly idempotencyKey: string | null;
}

export interface IFakeStripeSubscription {
  readonly id: string;
  readonly customer: string;
  readonly status: string;
}

export interface IFakeStripeSession {
  readonly id: string;
  readonly customer: string;
  readonly url: string;
  readonly mode: string;
  readonly status: string;
  readonly metadata: Record<string, string>;
}

export interface IFakeStripe {
  readonly stripe: Stripe;
  readonly requests: IFakeStripeRequest[];
  readonly subscriptions: IFakeStripeSubscription[];
  readonly sessions: IFakeStripeSession[];
}

const HTTP_METHOD = { get: "GET", post: "POST" } as const;

const ENDPOINT = {
  customers: "/v1/customers",
  subscriptions: "/v1/subscriptions",
  checkoutSessions: "/v1/checkout/sessions",
} as const;

const SESSION_OPEN = "open" as const;

const jsonResponse = (status: number, value: unknown): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });

const metadataFromParams = (
  params: URLSearchParams
): Record<string, string> => {
  const metadata: Record<string, string> = {};

  for (const [key, value] of params.entries()) {
    const match = /^metadata\[(.+)\]$/u.exec(key);

    if (match?.[1] !== undefined) {
      metadata[match[1]] = value;
    }
  }

  return metadata;
};

export const createFakeStripe = (): IFakeStripe => {
  const requests: IFakeStripeRequest[] = [];
  const subscriptions: IFakeStripeSubscription[] = [];
  const sessions: IFakeStripeSession[] = [];
  let sequence = 0;

  const nextId = (prefix: string): string => {
    sequence += 1;

    return `${prefix}_fake_${String(sequence)}`;
  };

  const route = (
    method: string,
    url: URL,
    params: URLSearchParams
  ): Response => {
    const path = url.pathname;
    const customer = params.get("customer");

    if (method === HTTP_METHOD.post && path === ENDPOINT.customers) {
      return jsonResponse(200, { id: nextId("cus"), object: "customer" });
    }

    if (method === HTTP_METHOD.get && path === ENDPOINT.subscriptions) {
      return jsonResponse(200, {
        object: "list",
        has_more: false,
        url: path,
        data: subscriptions.filter((item) => item.customer === customer),
      });
    }

    if (method === HTTP_METHOD.get && path === ENDPOINT.checkoutSessions) {
      return jsonResponse(200, {
        object: "list",
        has_more: false,
        url: path,
        data: sessions.filter(
          (item) => item.customer === customer && item.status === SESSION_OPEN
        ),
      });
    }

    if (method === HTTP_METHOD.post && path === ENDPOINT.checkoutSessions) {
      const session: IFakeStripeSession = {
        id: nextId("cs"),
        customer: customer ?? "",
        url: `https://checkout.stripe.test/${nextId("pay")}`,
        mode: params.get("mode") ?? "",
        status: SESSION_OPEN,
        metadata: metadataFromParams(params),
      };

      sessions.push(session);

      return jsonResponse(200, { ...session, object: "checkout.session" });
    }

    return jsonResponse(404, {
      error: {
        type: "invalid_request_error",
        message: `no fake for ${method} ${path}`,
      },
    });
  };

  const fetchImpl = (
    input: string | URL | Request,
    init?: RequestInit
  ): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? HTTP_METHOD.get;
    const rawForm = init?.body;
    const params =
      method === HTTP_METHOD.get
        ? url.searchParams
        : new URLSearchParams(typeof rawForm === "string" ? rawForm : "");

    requests.push({
      method,
      path: url.pathname,
      params,
      idempotencyKey: new Headers(init?.headers).get("idempotency-key"),
    });

    return Promise.resolve(route(method, url, params));
  };

  /* Bun's `typeof fetch` also carries `preconnect`; the fake must match it. */
  const fakeFetch = Object.assign(fetchImpl, { preconnect: () => undefined });

  const stripe = new Stripe("sk_test_fake_for_tests", {
    httpClient: Stripe.createFetchHttpClient(fakeFetch),
    maxNetworkRetries: 0,
  });

  return { stripe, requests, subscriptions, sessions };
};
