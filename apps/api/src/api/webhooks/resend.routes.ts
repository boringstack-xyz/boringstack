import { Elysia } from "elysia";

import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { ApiErrors, createSuccessResponse } from "../../lib/errors";
import { errorHandler } from "../../middleware/error-handler";

import {
  applyResendEvent,
  extractResendHeaders,
  verifyResendWebhook,
} from "./resend.utils";
import { WebhookAckResponse } from "./webhooks.schemas";

const resendWebhookRoutes = new Elysia()
  .onError(({ code, error, set }) =>
    errorHandler({ code: String(code), error, set })
  )
  .post(
    "/resend",
    async ({ request, headers }) => {
      if (env.RESEND_WEBHOOK_SECRET === "") {
        throw ApiErrors.notImplemented(
          "Resend webhook receiver is not configured"
        );
      }

      const svixHeaders = extractResendHeaders(headers);
      const rawBody = await request.text();
      const event = verifyResendWebhook(rawBody, svixHeaders, {
        secret: env.RESEND_WEBHOOK_SECRET,
      });
      const recorded = await applyResendEvent(event);

      logger.info("Processed Resend webhook event", {
        event: "webhook.resend.processed",
        type: event.type,
        recorded,
      });

      return createSuccessResponse({ received: true, recorded });
    },
    {
      response: WebhookAckResponse,
      detail: {
        tags: ["Webhooks"],
        summary: "Resend deliverability webhook receiver",
      },
    }
  );

export default resendWebhookRoutes;
