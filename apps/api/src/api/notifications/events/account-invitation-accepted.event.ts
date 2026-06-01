import { t } from "elysia";

import { defineNotificationEvent } from "../../../lib/notifications";

/**
 * Notification event: a user just accepted an invitation into an
 * account. Recipient is the inviter (or any account owner/admin) — the
 * invitations service hands the recipient id to `notifications.send`.
 *
 * Ships in-app only. Add a `render.email` block to also send the
 * inviter a confirmation email.
 */
export const accountInvitationAcceptedEvent = defineNotificationEvent({
  type: "account.invitation_accepted",
  schema: t.Object({
    accountId: t.String(),
    accountName: t.String(),
    inviteeEmail: t.String(),
    membershipsUrl: t.String({ format: "uri" }),
  }),
  defaultChannels: ["in-app"],
  render: {
    inApp: ({ payload }) => ({
      title: `${payload.inviteeEmail} joined ${payload.accountName}`,
      body: "Membership is active. Manage roles from the account settings.",
      ctaUrl: payload.membershipsUrl,
      ctaLabel: "View members",
    }),
  },
});
