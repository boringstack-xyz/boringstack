import { now } from "../../time/now";
import { and, eq } from "drizzle-orm";
import { db } from "../../../clients/postgres";
import { notificationDelivery } from "../../../clients/postgres/schema";
import { logger } from "../../../config/logger";
import { getErrorMessage } from "../../errors";
import {
  DELIVERY_STATUS,
  NOTIFICATION_CHANNELS,
} from "../notifications.constants";
import type {
  IChannelDispatchContext,
  INotificationChannel,
} from "../notifications.types";

/**
 * The in-app channel is the simplest of the registered channels: the
 * `notification` row inserted by the worker IS the in-app delivery. This
 * channel just marks its delivery row `sent` and (in Phase 5) hands off to
 * the SSE pub/sub so connected sessions are notified in realtime.
 *
 * The handler exists separately even though its job is small because every
 * channel must record a `notification_delivery` row for cross-channel
 * status visibility — keeping that bookkeeping uniform avoids special cases
 * in the worker.
 */
class InAppChannel implements INotificationChannel {
  readonly name = NOTIFICATION_CHANNELS.IN_APP;

  async dispatch(ctx: IChannelDispatchContext): Promise<void> {
    const nowIso = now();

    try {
      await db
        .update(notificationDelivery)
        .set({
          status: DELIVERY_STATUS.SENT,
          sentAt: nowIso,
          updatedAt: nowIso,
        })
        .where(
          and(
            eq(notificationDelivery.notificationId, ctx.notificationId),
            eq(notificationDelivery.channel, NOTIFICATION_CHANNELS.IN_APP)
          )
        );
    } catch (error: unknown) {
      logger.error("In-app channel dispatch failed", {
        event: "notifications.channel.in_app.failed",
        notificationId: ctx.notificationId,
        error: getErrorMessage(error),
      });

      throw error;
    }
  }
}

export const inAppChannel = new InAppChannel();
