import { t } from "elysia";

export const PlanResponse = t.Object({
  id: t.Number(),
  name: t.String(),
  isDefault: t.Boolean(),
});

export const PlanListResponse = t.Array(PlanResponse);

export const SubscriptionResponse = t.Object({
  planId: t.Number(),
  planName: t.String(),
  isDefault: t.Boolean(),
  status: t.String(),
  hasStripeSubscription: t.Boolean(),
});

export const StripeCheckoutResponse = t.Object({
  url: t.String(),
});

export const StripePortalResponse = t.Object({
  url: t.String(),
});

export const WebhookResponse = t.Object({
  success: t.Boolean(),
  data: t.Object({
    received: t.Boolean(),
    type: t.String(),
  }),
  timestamp: t.String(),
});

export const CreateCheckoutSessionSchema = t.Object({
  planId: t.Number(),
  successUrl: t.String({ format: "uri" }),
  cancelUrl: t.String({ format: "uri" }),
});

export const CreatePortalSessionSchema = t.Object({
  returnUrl: t.String({ format: "uri" }),
});
