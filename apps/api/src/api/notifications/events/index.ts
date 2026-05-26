import type { INotificationEventDefinition } from "../../../lib/notifications";

import { authWelcomeEvent } from "./auth-welcome.event";

export { authWelcomeEvent };

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
];
