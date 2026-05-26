import { t } from "elysia";

import { defineNotificationEvent } from "../../../lib/notifications";

/**
 * Notification event: a user has just verified their email (or completed
 * their first OAuth callback). Fired exactly once per fresh user — the
 * `emailVerificationService` and `oauthAuthService` both call
 * `notifications.send(authWelcomeEvent, ...)` from inside the same
 * provisioning transaction.
 *
 * The example ships in-app only. Multi-channel events add a `render.email`
 * block with a `templatePath` (under `src/templates/email/templates/`) and
 * a `variables` mapper. Web Push fans out automatically when the channel
 * is registered — no per-event hook required.
 */
export const authWelcomeEvent = defineNotificationEvent({
  type: "auth.welcome",
  schema: t.Object({
    firstName: t.String(),
    dashboardUrl: t.String({ format: "uri" }),
  }),
  defaultChannels: ["in-app"],
  render: {
    inApp: ({ payload }) => {
      const greeting =
        payload.firstName === ""
          ? "Welcome aboard."
          : `Welcome, ${payload.firstName}.`;

      return {
        title: greeting,
        body: "Your account is ready. Take a tour of the dashboard whenever you're ready.",
        ctaUrl: payload.dashboardUrl,
        ctaLabel: "Open dashboard",
      };
    },
  },
});
