import { logger } from "../../../config/logger";
import type { INotificationChannel } from "../notifications.types";

/**
 * Singleton lookup of channel name → implementation. Channels register at
 * boot. The worker fans out to channels based on the event's
 * `defaultChannels` (or per-user preferences once Phase 4 lands).
 *
 * Registration is idempotent: re-registering the same `name` overwrites,
 * useful for tests that swap a real channel for a mock.
 */
export class ChannelRegistry {
  private readonly channels = new Map<string, INotificationChannel>();

  register(channel: INotificationChannel): void {
    if (this.channels.has(channel.name)) {
      logger.warn("Notification channel re-registered", {
        event: "notifications.channel_registry.collision",
        channelName: channel.name,
      });
    }

    this.channels.set(channel.name, channel);
  }

  get(name: string): INotificationChannel | undefined {
    return this.channels.get(name);
  }

  has(name: string): boolean {
    return this.channels.has(name);
  }

  /** Test helper. Never call from production code. */
  clear(): void {
    this.channels.clear();
  }

  size(): number {
    return this.channels.size;
  }
}

export const channelRegistry = new ChannelRegistry();
