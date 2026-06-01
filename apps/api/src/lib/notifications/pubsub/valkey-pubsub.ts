import { Redis } from "ioredis";
import {
  getValkeyAppClientOptions,
  getValkeyConnectionOptions,
} from "../../../clients/valkey";
import { logger } from "../../../config/logger";
import { getErrorMessage } from "../../errors";
import type { IPubSubSubscriber } from "./valkey-pubsub.types";

/**
 * Dedicated Valkey pub/sub primitives. Pub/sub clients can't share a
 * connection with anything else — when a client is in subscriber mode the
 * server rejects every other command. BullMQ's own connection is therefore
 * unusable for notifications fan-out, so this class opens separate ioredis
 * clients: one long-lived publisher (shared across PUBLISH calls) and a
 * fresh subscriber per SSE connection.
 *
 * Wrapped as a class so the publisher state lives on an instance instead of
 * a module-scope variable, keeping this file single-concern (one class —
 * no mixed const/function categories).
 */
export class ValkeyPubSub {
  private publisher: Redis | null = null;

  async publish(channel: string, message: string): Promise<void> {
    /*
     * Publisher is a one-shot command — failing fast keeps a slow
     * Valkey from stalling the request that is publishing.
     */
    this.publisher ??= new Redis(getValkeyAppClientOptions());

    try {
      await this.publisher.publish(channel, message);
    } catch (error: unknown) {
      logger.error("Valkey publish failed", {
        event: "notifications.pubsub.publish_failed",
        channel,
        error: getErrorMessage(error),
      });

      throw error;
    }
  }

  /**
   * Build a subscriber client bound to a single channel. The caller is
   * responsible for calling `disconnect()` when done — typically inside the
   * SSE handler's `finally` block when the client disconnects.
   *
   * The `onMessage` callback receives raw string payloads; parsing is the
   * caller's concern (the SSE route forwards the string verbatim, the test
   * harness JSON-parses).
   */
  async subscribe(
    channel: string,
    onMessage: (message: string) => void
  ): Promise<IPubSubSubscriber> {
    /*
     * Subscriber holds a long-lived SUBSCRIBE session. ioredis must
     * keep retrying on transient errors and queue commands while the
     * connection comes up — exactly what `getValkeyConnectionOptions`
     * (BullMQ-style, `maxRetriesPerRequest: null`) provides. The
     * fail-fast profile breaks `subscribe()` because the first command
     * races the connection.
     */
    const client = new Redis(getValkeyConnectionOptions());

    client.on("message", (incomingChannel: string, message: string) => {
      if (incomingChannel === channel) {
        onMessage(message);
      }
    });

    client.on("error", (err: Error) => {
      logger.error("Valkey subscriber error", {
        event: "notifications.pubsub.subscribe_error",
        channel,
        error: err.message,
      });
    });

    await client.subscribe(channel);

    return {
      disconnect: async (): Promise<void> => {
        try {
          await client.unsubscribe(channel);
        } catch (error: unknown) {
          logger.warn("Valkey unsubscribe failed (will quit anyway)", {
            event: "notifications.pubsub.unsubscribe_failed",
            channel,
            error: getErrorMessage(error),
          });
        }

        await this.closeClient(client);
      },
    };
  }

  /** Test helper. Disposes the shared publisher so unit tests can reset state. */
  async resetForTests(): Promise<void> {
    if (this.publisher === null) {
      return;
    }

    await this.closeClient(this.publisher);
    this.publisher = null;
  }

  private async closeClient(client: Redis): Promise<void> {
    if (client.status === "ready") {
      await client.quit();

      return;
    }

    client.disconnect();
  }
}

export const valkeyPubSub = new ValkeyPubSub();
