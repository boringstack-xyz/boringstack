import { Elysia } from "elysia";

import resendWebhookRoutes from "./resend.routes";
import sendGridWebhookRoutes from "./sendgrid.routes";

/**
 * Provider webhook receivers for email deliverability events. Each
 * provider exposes its own subpath:
 *
 *   - `POST /api/v1/webhooks/resend`     — svix-signed bounce / complaint
 *   - `POST /api/v1/webhooks/sendgrid`   — ECDSA-signed Event Webhook
 *
 * Stripe's webhook receiver is intentionally NOT mounted here — it
 * predates this module and lives at `/api/v1/billing/stripe/webhooks`
 * for backward compatibility with already-configured Stripe endpoints.
 */
const webhookRoutes = new Elysia()
  .use(resendWebhookRoutes)
  .use(sendGridWebhookRoutes);

export default webhookRoutes;
