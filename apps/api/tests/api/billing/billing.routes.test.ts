import { beforeEach, describe, expect, test } from "bun:test";
import Stripe from "stripe";

import { getBillingService } from "../../../src/api/billing/billing.service";
import { createApp } from "../../../src/config/app";
import { env } from "../../../src/config/env";
import { AUTH_COOKIE_NAME } from "../../../src/lib/cookies";
import { seedVerifiedUser } from "../../helpers/auth";
import {
  accounts,
  cleanDatabase,
  db,
  eq,
  plans,
  requireDb,
} from "../../helpers/db";

const signStripeTestHeader = async (rawBody: string): Promise<string> =>
  Stripe.webhooks.generateTestHeaderStringAsync({
    payload: rawBody,
    secret: env.STRIPE_WEBHOOK_SECRET,
  });

const findCookieValue = (
  setCookies: readonly string[] | null,
  name: string
): string => {
  if (setCookies === null) {
    return "";
  }

  for (const raw of setCookies) {
    if (!raw.startsWith(`${name}=`)) {
      continue;
    }

    const semi = raw.indexOf(";");

    return semi === -1 ? raw : raw.slice(0, semi);
  }

  return "";
};

const FOREIGN_ORIGIN = "https://attacker.example/oops";

const loginCookie = async (
  app: ReturnType<typeof createApp>,
  email: string,
  password: string
): Promise<string> => {
  const res = await app.handle(
    new Request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
  );

  const cookie = findCookieValue(res.headers.getSetCookie(), AUTH_COOKIE_NAME);

  if (cookie === "") {
    throw new Error(
      `login did not set auth_token (status=${String(res.status)})`
    );
  }

  return cookie;
};

describe("GET /api/v1/billing/plans", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("401 without an auth cookie", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/billing/plans")
    );

    expect(res.status).toBe(401);
  });

  test("200 + plans array for an authenticated user", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { password } = await seedVerifiedUser({ email: "plans@example.com" });
    const app = createApp();
    const cookie = await loginCookie(app, "plans@example.com", password);

    const res = await app.handle(
      new Request("http://localhost/api/v1/billing/plans", {
        headers: { cookie },
      })
    );

    expect(res.status).toBe(200);

    const planRows = await db.select().from(plans);

    expect(planRows.length).toBeGreaterThan(0);
  });
});

describe("GET /api/v1/billing/subscription", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("401 without an auth cookie", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/billing/subscription")
    );

    expect(res.status).toBe(401);
  });

  test("200 + default subscription for a free account", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { password } = await seedVerifiedUser({
      email: "subscription@example.com",
    });
    const app = createApp();
    const cookie = await loginCookie(app, "subscription@example.com", password);

    const res = await app.handle(
      new Request("http://localhost/api/v1/billing/subscription", {
        headers: { cookie },
      })
    );

    expect(res.status).toBe(200);

    const body = await res.text();

    expect(body).toContain('"planName":"Free"');
    expect(body).toContain('"hasStripeSubscription":false');
    expect(body).toContain('"isDefault":true');
  });
});

describe("POST /api/v1/billing/stripe/checkout-session", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("401 without an auth cookie", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/billing/stripe/checkout-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planId: 1,
          successUrl: `${env.FRONTEND_URL}/billing/success`,
          cancelUrl: `${env.FRONTEND_URL}/billing/cancel`,
        }),
      })
    );

    expect(res.status).toBe(401);
  });

  test("rejects a redirect URL outside the configured FRONTEND_URL origin", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { password } = await seedVerifiedUser({
      email: "checkout@example.com",
    });
    const app = createApp();
    const cookie = await loginCookie(app, "checkout@example.com", password);

    const res = await app.handle(
      new Request("http://localhost/api/v1/billing/stripe/checkout-session", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          planId: 1,
          successUrl: FOREIGN_ORIGIN,
          cancelUrl: `${env.FRONTEND_URL}/billing/cancel`,
        }),
      })
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);

    const body = await res.text();

    expect(body).toMatch(/origin/i);
  });

  test("rejects a malformed body (TypeBox validation)", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { password } = await seedVerifiedUser({
      email: "checkout-bad@example.com",
    });
    const app = createApp();
    const cookie = await loginCookie(app, "checkout-bad@example.com", password);

    const res = await app.handle(
      new Request("http://localhost/api/v1/billing/stripe/checkout-session", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ planId: "not-a-number" }),
      })
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

describe("POST /api/v1/billing/stripe/portal-session", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("401 without an auth cookie", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/billing/stripe/portal-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          returnUrl: `${env.FRONTEND_URL}/billing`,
        }),
      })
    );

    expect(res.status).toBe(401);
  });

  test("rejects a return URL outside the configured FRONTEND_URL origin", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { password } = await seedVerifiedUser({
      email: "portal@example.com",
    });
    const app = createApp();
    const cookie = await loginCookie(app, "portal@example.com", password);

    const res = await app.handle(
      new Request("http://localhost/api/v1/billing/stripe/portal-session", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ returnUrl: FOREIGN_ORIGIN }),
      })
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

describe("POST /api/v1/billing/stripe/webhooks", () => {
  test("400 when the Stripe-Signature header is missing", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/billing/stripe/webhooks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      })
    );

    expect(res.status).toBe(400);
  });

  test("200 + received payload when the signature is valid", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { account } = await seedVerifiedUser({
      email: `billing-route-wh-${String(Date.now())}@example.com`,
    });
    const customerId = `cus_route_${account.id.slice(0, 8)}`;

    await getBillingService().listPlans();

    await db
      .update(accounts)
      .set({ stripeCustomerId: customerId })
      .where(eq(accounts.id, account.id));

    const pro = await db.query.plans.findFirst({
      where: eq(plans.name, "Pro"),
    });

    if (!pro) {
      throw new Error("Pro plan not seeded");
    }

    const body = JSON.stringify({
      id: "evt_http_checkout",
      type: "checkout.session.completed",
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          customer: customerId,
          metadata: { accountId: account.id, planId: String(pro.id) },
        },
      },
    });
    const signature = await signStripeTestHeader(body);
    const app = createApp();

    const res = await app.handle(
      new Request("http://localhost/api/v1/billing/stripe/webhooks", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "stripe-signature": signature,
        },
        body,
      })
    );

    expect(res.status).toBe(200);
  });
});
