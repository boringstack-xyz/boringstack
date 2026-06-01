import { t } from "elysia";

import { defineNotificationEvent } from "../../../lib/notifications";

/**
 * Notification event: an account ownership transfer just completed.
 * Recipient is the *outgoing* owner so they have an in-app record of
 * the role downgrade; the new owner already knows they accepted.
 */
export const accountOwnershipTransferredEvent = defineNotificationEvent({
  type: "account.ownership_transferred",
  schema: t.Object({
    accountId: t.String(),
    accountName: t.String(),
    newOwnerEmail: t.String(),
    settingsUrl: t.String({ format: "uri" }),
  }),
  defaultChannels: ["in-app"],
  render: {
    inApp: ({ payload }) => ({
      title: `${payload.newOwnerEmail} is the new owner of ${payload.accountName}`,
      body: "Your role on this account dropped to admin. You can still manage members and settings.",
      ctaUrl: payload.settingsUrl,
      ctaLabel: "Open settings",
    }),
  },
});
