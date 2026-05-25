import type { INotificationEventDefinition } from "../../../lib/notifications";

/**
 * Notification event registry barrel.
 *
 * Author new events as files in this directory (`*.event.ts`) and append
 * them to the `allEvents` array below — `bun run new:notification-event
 * <name>` automates both. The framework registers everything in this array
 * at boot via `setupNotifications()`.
 *
 * Ships empty. The framework deliberately defines no example events; the
 * template stays clean for forks (see also the `app.schema.ts` policy).
 */
export const allEvents: readonly INotificationEventDefinition<unknown>[] = [];
