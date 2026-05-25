import { Elysia } from "elysia";

import { ApiErrors, createSuccessResponse } from "../../lib/errors";
import { errorHandler } from "../../middleware/error-handler";
import { createAuthMiddleware } from "../auth/auth.plugin";

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
import { resolveBillingAccount } from "./billing.utils";

const billingRoutes = new Elysia()
  .use(
    createAuthMiddleware()
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
        async ({ accountId }) => getBillingService().getSubscription(accountId),
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
