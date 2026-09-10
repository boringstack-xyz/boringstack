import { Elysia } from "elysia";

import { ApiErrors, createSuccessResponse } from "../../lib/errors";
import { errorHandler } from "../../middleware/error-handler";
import { requireAuth } from "../auth/auth.plugin";

import {
  CreateCheckoutSessionSchema,
  CreatePortalSessionSchema,
  PlanListResponse,
  StripeCheckoutResponse,
  StripePortalResponse,
  SubscriptionResponse,
  WebhookResponse,
} from "./billing.schemas";
import { getBillingService } from "./billing.service";
import { resolveFreshMembership } from "../../middleware/require-active-membership";
import { resolveBillingAccount } from "./billing.utils";

const billingRoutes = new Elysia()
  .use(
    requireAuth()
      .onError(({ code, error, set }) =>
        errorHandler({ code: String(code), error, set })
      )
      .get("/plans", async () => getBillingService().listPlans(), {
        response: PlanListResponse,
        detail: {
          tags: ["Billing"],
          summary: "List available plans",
          security: [{ cookieAuth: [] }],
        },
      })
      .get(
        "/subscription",
        async ({ accountId, user }) => {
          /*
           * Membership is re-checked here, not taken from the token.
           * `requireAuth` validates signature, expiry and revocation and
           * says nothing about whether the caller still belongs to the
           * account, so without this a removed member reads this account's
           * billing state until their access token expires.
           *
           * The FRESH variant, not the memoized one. The memo is keyed by
           * (user, account) with its own TTL, so a revocation that lands
           * inside that window is invisible — which is the same "stale
           * authorization" defect one layer down, and it reproduces in this
           * test.
           */
          await resolveFreshMembership(user.id, accountId);

          return getBillingService().getSubscription(accountId);
        },
        {
          response: SubscriptionResponse,
          detail: {
            tags: ["Billing"],
            summary: "Current account subscription",
            security: [{ cookieAuth: [] }],
          },
        }
      )
      .post(
        "/stripe/checkout-session",
        async ({ body, user, accountId }) => {
          const billingAccountId = await resolveBillingAccount(
            user.id,
            accountId
          );

          return getBillingService().createCheckoutSession(
            body.planId,
            billingAccountId,
            user.id,
            body.successUrl,
            body.cancelUrl
          );
        },
        {
          body: CreateCheckoutSessionSchema,
          response: StripeCheckoutResponse,
          detail: {
            tags: ["Billing"],
            summary: "Create Stripe Checkout session",
            security: [{ cookieAuth: [] }],
          },
        }
      )
      .post(
        "/stripe/portal-session",
        async ({ body, user, accountId }) => {
          const billingAccountId = await resolveBillingAccount(
            user.id,
            accountId
          );

          return getBillingService().createPortalSession(
            billingAccountId,
            user.id,
            body.returnUrl
          );
        },
        {
          body: CreatePortalSessionSchema,
          response: StripePortalResponse,
          detail: {
            tags: ["Billing"],
            summary: "Create Stripe Customer Portal session",
            security: [{ cookieAuth: [] }],
          },
        }
      )
  )
  .use(
    new Elysia()
      .onError(({ code, error, set }) =>
        errorHandler({ code: String(code), error, set })
      )
      .post(
        "/stripe/webhooks",
        async ({ request, headers }) => {
          const signature = headers["stripe-signature"];

          if (signature === undefined || signature === "") {
            throw ApiErrors.validation("Missing Stripe signature header");
          }

          const payload = await request.text();
          const service = getBillingService();
          const event = await service.constructWebhookEvent(payload, signature);

          await service.handleWebhookEvent(event);

          return createSuccessResponse({
            received: true,
            type: event.type,
          });
        },
        {
          response: WebhookResponse,
          detail: {
            tags: ["Billing"],
            summary: "Stripe webhook receiver",
          },
        }
      )
  );

export default billingRoutes;
