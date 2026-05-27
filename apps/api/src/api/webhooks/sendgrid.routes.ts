import { Elysia } from "elysia";

import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { ApiErrors, createSuccessResponse } from "../../lib/errors";
import { errorHandler } from "../../middleware/error-handler";

import {
  applySendGridEvent,
  extractSendGridHeaders,
  verifySendGridWebhook,
} from "./sendgrid.utils";
import { WebhookAckResponse } from "./webhooks.schemas";

const sendGridWebhookRoutes = new Elysia()
  .onError(({ code, error, set }) =>
    errorHandler({ code: String(code), error, set })
  )
  .post(
    "/sendgrid",
    async ({ request, headers }) => {
      if (env.SENDGRID_WEBHOOK_PUBLIC_KEY === "") {
        throw ApiErrors.notImplemented(
          "SendGrid webhook receiver is not configured"
        );
      }

      const signedHeaders = extractSendGridHeaders(headers);
      const rawBody = await request.text();
      const events = verifySendGridWebhook(rawBody, signedHeaders, {
        publicKeyPem: env.SENDGRID_WEBHOOK_PUBLIC_KEY,
      });

      let recorded = 0;

      for (const event of events) {
        recorded += await applySendGridEvent(event);
      }

      logger.info("Processed SendGrid webhook batch", {
        event: "webhook.sendgrid.processed",
        batchSize: events.length,
        recorded,
      });

      return createSuccessResponse({ received: true, recorded });
    },
    {
      response: WebhookAckResponse,
      detail: {
        tags: ["Webhooks"],
        summary: "SendGrid deliverability webhook receiver",
      },
    }
  );

export default sendGridWebhookRoutes;
