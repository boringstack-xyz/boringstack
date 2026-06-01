import type { INotificationEventDefinition } from "../../../lib/notifications";

import { accountInvitationAcceptedEvent } from "./account-invitation-accepted.event";
import { accountOwnershipTransferredEvent } from "./account-ownership-transferred.event";
import { authWelcomeEvent } from "./auth-welcome.event";
import { passwordResetCompletedEvent } from "./password-reset-completed.event";

export {
  accountInvitationAcceptedEvent,
  accountOwnershipTransferredEvent,
  authWelcomeEvent,
  passwordResetCompletedEvent,
};

/**
 * Notification event registry barrel. The framework registers everything
 * in this array at boot via `setupNotifications()`.
 *
 * Author new events as files in this directory (`*.event.ts`) and append
 * them to the `allEvents` array below — `bun run new:notification-event
 * <name>` automates both. Crib from `auth-welcome.event.ts` for the
 * typed-payload + render shape; add `render.email` and/or extend
 * `defaultChannels` for multi-channel events.
 */
export const allEvents: readonly INotificationEventDefinition<unknown>[] = [
  authWelcomeEvent,
  accountInvitationAcceptedEvent,
  accountOwnershipTransferredEvent,
  passwordResetCompletedEvent,
];
