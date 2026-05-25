import { now } from "../../time/now";
import { and, eq } from "drizzle-orm";
import { db } from "../../../clients/postgres";
import { notificationDelivery } from "../../../clients/postgres/schema";
import { logger } from "../../../config/logger";
import { getErrorMessage } from "../../errors";
import {
  DELIVERY_STATUS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUS,
} from "../notifications.constants";
import type {
  IChannelDispatchContext,
  INotificationChannel,
} from "../notifications.types";
import { valkeyPubSub } from "../pubsub/valkey-pubsub";
import { userNotificationChannel } from "../pubsub/user-notification-channel";

/**
 * Realtime channel. After the dispatch worker persists a notification +
 * delivery row, this channel publishes the rendered payload on a per-user
 * Valkey pub/sub channel. The SSE endpoint (mounted on the HTTP side)
 * subscribes to the same channel and forwards messages to any connected
 * browser session.
 *
 * Multi-instance safe: any API instance can `publishToChannel`, the
 * instance that holds the SSE connection forwards. Decoupled because
 * pub/sub clients have to be dedicated subscribers (`subscribeToChannel`
 * opens a fresh ioredis client per SSE connection).
 *
 * The channel transitions its delivery row to `sent` after publish — there
 * is no acknowledgement from the SSE subscriber, so "sent" here means
 * "broadcast to whoever was listening at this moment." It's lossy by
 * design; the in-app channel + persisted `notification` row are the
 * durable surface.
 */
class SseChannel implements INotificationChannel {
  readonly name = NOTIFICATION_CHANNELS.SSE;

  async dispatch(ctx: IChannelDispatchContext): Promise<void> {
    const channel = userNotificationChannel(ctx.recipientUserId);
    const createdAt = now();

    const message = JSON.stringify({
      type: "notification.created",
      notification: {
        id: ctx.notificationId,
        eventType: ctx.event.type,
        title: ctx.rendered.title,
        body: ctx.rendered.body,
        ctaUrl: ctx.rendered.ctaUrl ?? null,
        ctaLabel: ctx.rendered.ctaLabel ?? null,
        status: NOTIFICATION_STATUS.UNREAD,
        readAt: null,
        createdAt,
      },
    });

    try {
      await valkeyPubSub.publish(channel, message);
      await this.markSent(ctx.notificationId);
    } catch (error: unknown) {
      logger.error("SSE channel publish failed", {
        event: "notifications.channel.sse.failed",
        notificationId: ctx.notificationId,
        error: getErrorMessage(error),
      });
      await this.markFailed(ctx.notificationId, getErrorMessage(error));

      throw error;
    }
  }

  private async markSent(notificationId: string): Promise<void> {
    const nowIso = now();

    await db
      .update(notificationDelivery)
      .set({
        status: DELIVERY_STATUS.SENT,
        sentAt: nowIso,
        updatedAt: nowIso,
      })
      .where(
        and(
          eq(notificationDelivery.notificationId, notificationId),
          eq(notificationDelivery.channel, NOTIFICATION_CHANNELS.SSE)
        )
      );
  }

  private async markFailed(
    notificationId: string,
    error: string
  ): Promise<void> {
    const nowIso = now();

    await db
      .update(notificationDelivery)
      .set({
        status: DELIVERY_STATUS.FAILED,
        failedAt: nowIso,
        updatedAt: nowIso,
        error,
      })
      .where(
        and(
          eq(notificationDelivery.notificationId, notificationId),
          eq(notificationDelivery.channel, NOTIFICATION_CHANNELS.SSE)
        )
      );
  }
}

export const sseChannel = new SseChannel();
