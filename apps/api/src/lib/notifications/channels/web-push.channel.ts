import { and, eq } from "drizzle-orm";
import { db } from "../../../clients/postgres";
import {
  notificationDelivery,
  pushSubscription,
} from "../../../clients/postgres/schema";
import { env } from "../../../config/env";
import { logger } from "../../../config/logger";
import { getQueueManager } from "../../../config/setup";
import { now } from "../../time/now";
import {
  DELIVERY_STATUS,
  NOTIFICATION_CHANNELS,
} from "../notifications.constants";
import type {
  IChannelDispatchContext,
  INotificationChannel,
} from "../notifications.types";

/**
 * Web Push channel. Resolves all live `push_subscription` rows for the
 * recipient and enqueues a single `web-push-delivery` job per notification.
 * The worker fans out per-subscription POSTs and settles the delivery row
 * once every sub has either succeeded, failed, or been pruned (410 Gone).
 *
 * Behaviour summary:
 *   - Zero subscriptions  → `suppressed` (no devices to deliver to).
 *   - ≥1 subscriptions    → job enqueued; worker settles `sent` / `failed`.
 *   - Queues disabled     → `failed` with `web_push_requires_queues`; the
 *     channel only ships as queued delivery because per-subscription HTTP
 *     fan-out doesn't belong on the request thread.
 *
 * The channel only registers when all three VAPID env vars are set — see
 * `setup-notifications.ts`. Once registered, it participates in the
 * normal dispatcher fan-out alongside in-app, email, and sse.
 */
class WebPushChannel implements INotificationChannel {
  readonly name = NOTIFICATION_CHANNELS.WEB_PUSH;

  async dispatch(ctx: IChannelDispatchContext): Promise<void> {
    const deliveryId = await this.findDeliveryId(ctx.notificationId);

    if (deliveryId === null) {
      logger.warn("Web Push channel could not locate its delivery row", {
        event: "notifications.channel.web_push.delivery_missing",
        notificationId: ctx.notificationId,
      });

      return;
    }

    const liveSubscriptions = await db
      .select({ id: pushSubscription.id })
      .from(pushSubscription)
      .where(eq(pushSubscription.userId, ctx.recipientUserId));

    if (liveSubscriptions.length === 0) {
      await this.markSuppressed(deliveryId, "no_subscriptions");

      return;
    }

    if (!env.QUEUES_ENABLED) {
      logger.warn("Web Push channel requires QUEUES_ENABLED=true", {
        event: "notifications.channel.web_push.queues_disabled",
        notificationId: ctx.notificationId,
      });
      await this.markFailed(deliveryId, "web_push_requires_queues");

      return;
    }

    const manager = getQueueManager();

    if (manager === null) {
      logger.warn("Web Push channel: QueueManager not initialized", {
        event: "notifications.channel.web_push.queue_manager_missing",
        notificationId: ctx.notificationId,
      });
      await this.markFailed(deliveryId, "queue_manager_not_initialized");

      return;
    }

    await manager.enqueueWebPushDelivery({
      recipientUserId: ctx.recipientUserId,
      notificationDeliveryId: deliveryId,
      title: ctx.rendered.title,
      body: ctx.rendered.body,
      url: ctx.rendered.ctaUrl ?? null,
    });
  }

  private async findDeliveryId(notificationId: string): Promise<string | null> {
    const [row] = await db
      .select({ id: notificationDelivery.id })
      .from(notificationDelivery)
      .where(
        and(
          eq(notificationDelivery.notificationId, notificationId),
          eq(notificationDelivery.channel, NOTIFICATION_CHANNELS.WEB_PUSH)
        )
      );

    return row?.id ?? null;
  }

  private async markSuppressed(
    deliveryId: string,
    reason: string
  ): Promise<void> {
    const nowIso = now();

    await db
      .update(notificationDelivery)
      .set({
        status: DELIVERY_STATUS.SUPPRESSED,
        updatedAt: nowIso,
        error: reason,
      })
      .where(eq(notificationDelivery.id, deliveryId));
  }

  private async markFailed(deliveryId: string, reason: string): Promise<void> {
    const nowIso = now();

    await db
      .update(notificationDelivery)
      .set({
        status: DELIVERY_STATUS.FAILED,
        failedAt: nowIso,
        updatedAt: nowIso,
        error: reason,
        attempts: 1,
      })
      .where(eq(notificationDelivery.id, deliveryId));
  }
}

export const webPushChannel = new WebPushChannel();
