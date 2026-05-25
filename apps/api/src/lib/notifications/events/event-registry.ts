import { logger } from "../../../config/logger";
import type { IRegisteredEvent } from "../notifications.types";

/**
 * Singleton lookup of event-type id → runtime event record. The dispatcher
 * populates this at boot from `src/api/notifications/events/index.ts` (the
 * scaffolder-managed barrel). The worker consults it to validate, dedup,
 * render, and channel-route every job.
 *
 * Registration is idempotent: re-registering a `type` overwrites the prior
 * definition with a warning, since collisions usually indicate two events
 * authored with the same id.
 */
export class EventRegistry {
  private readonly events = new Map<string, IRegisteredEvent>();

  register(event: IRegisteredEvent): void {
    if (this.events.has(event.type)) {
      logger.warn("Notification event re-registered (id collision)", {
        event: "notifications.event_registry.collision",
        eventType: event.type,
      });
    }

    this.events.set(event.type, event);
  }

  registerAll(events: readonly IRegisteredEvent[]): void {
    for (const event of events) {
      this.register(event);
    }
  }

  get(eventType: string): IRegisteredEvent | undefined {
    return this.events.get(eventType);
  }

  has(eventType: string): boolean {
    return this.events.has(eventType);
  }

  /** Test helper. Never call from production code. */
  clear(): void {
    this.events.clear();
  }

  size(): number {
    return this.events.size;
  }
}

export const eventRegistry = new EventRegistry();
