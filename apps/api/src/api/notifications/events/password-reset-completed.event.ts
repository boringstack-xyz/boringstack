import { t } from "elysia";

import { defineNotificationEvent } from "../../../lib/notifications";

/**
 * Notification event: the user's password was just reset via the
 * reset-token flow. Recipient is the user themselves — gives them an
 * in-app trail that matches the confirmation email already sent.
 *
 * If the user didn't initiate the reset, this is the alert that
 * surfaces the change quickly so they can re-secure the account.
 */
export const passwordResetCompletedEvent = defineNotificationEvent({
  type: "auth.password_reset_completed",
  schema: t.Object({
    securityUrl: t.String({ format: "uri" }),
  }),
  defaultChannels: ["in-app"],
  render: {
    inApp: ({ payload }) => ({
      title: "Your password was reset",
      body: "If this wasn't you, change your password again and review your active sessions.",
      ctaUrl: payload.securityUrl,
      ctaLabel: "Review security",
    }),
  },
});
