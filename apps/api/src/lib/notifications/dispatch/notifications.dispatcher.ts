import { Value } from "@sinclair/typebox/value";
import { env } from "../../../config/env";
import { logger } from "../../../config/logger";
import { getQueueManager } from "../../../config/setup";
import { ApiErrors, getErrorMessage } from "../../errors";
import type {
  INotificationEvent,
  INotificationSendInput,
} from "../notifications.types";
import { runNotificationDispatch } from "./dispatch-job";

/**
 * The public notifications API. Callers do:
 *
 *   void notifications.send(commentRepliedEvent, {
 *     recipientUserId,
 *     payload: { ... },  // typed by `commentRepliedEvent.schema`
 *   });
 *
 * Fire-and-forget — mirrors the audit-log ergonomics already established in
 * this codebase. The dispatcher validates the payload synchronously so
 * malformed call sites fail fast, then either enqueues a BullMQ job
 * (`QUEUES_ENABLED=true`) or runs the dispatch inline. Both paths share the
 * same `runNotificationDispatch` core, so behaviour is identical regardless
 * of topology.
 */
export class NotificationDispatcher {
  /**
   * Validates `payload` against the event's schema, then enqueues or runs
   * inline. Resolves once the work is durably enqueued (BullMQ) or
   * completed (inline). Tests typically `await`; production call sites are
   * `void`-prefixed because notification delivery should never block a
   * request.
   */
  async send<TPayload>(
    event: INotificationEvent<TPayload>,
    args: INotificationSendInput<TPayload>
  ): Promise<void> {
    if (!Value.Check(event.schema, args.payload)) {
      const errors = [...Value.Errors(event.schema, args.payload)].map(
        (err) => ({ path: err.path, message: err.message })
      );

      logger.error("Notification payload failed schema validation", {
        event: "notifications.send.invalid_payload",
        eventType: event.type,
        errors,
      });

      throw ApiErrors.internal(
        `Notification payload for "${event.type}" failed schema validation`
      );
    }

    const jobData = {
      eventType: event.type,
      recipientUserId: args.recipientUserId,
      payload: args.payload,
      channelsOverride: args.channelsOverride,
    };

    if (env.QUEUES_ENABLED) {
      const manager = getQueueManager();

      if (manager !== null) {
        await manager.enqueueNotificationDispatch(jobData);

        return;
      }

      logger.warn(
        "QUEUES_ENABLED=true but QueueManager is not initialized; dispatching inline",
        {
          event: "notifications.send.queue_fallback_inline",
          eventType: event.type,
        }
      );
    }

    try {
      await runNotificationDispatch(jobData);
    } catch (error: unknown) {
      logger.error("Inline notification dispatch failed", {
        event: "notifications.send.inline_failed",
        eventType: event.type,
        error: getErrorMessage(error),
      });

      throw error;
    }
  }
}

export const notifications = new NotificationDispatcher();
