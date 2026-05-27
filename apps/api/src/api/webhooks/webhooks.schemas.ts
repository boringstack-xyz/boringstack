import { t } from "elysia";

/**
 * Provider webhooks all return the same minimal ACK envelope: a count
 * of suppression rows the payload produced. Surfacing the count makes
 * end-to-end smoke checks straightforward without leaking event-level
 * details back to the provider.
 */
export const WebhookAckResponse = t.Object({
  success: t.Boolean(),
  data: t.Object({
    received: t.Boolean(),
    recorded: t.Number(),
  }),
  timestamp: t.String(),
});
