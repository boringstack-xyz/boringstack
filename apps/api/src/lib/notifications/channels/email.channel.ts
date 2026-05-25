import { now } from "../../time/now";
import { and, eq } from "drizzle-orm";
import { db } from "../../../clients/postgres";
import { notificationDelivery, users } from "../../../clients/postgres/schema";
import { env } from "../../../config/env";
import { logger } from "../../../config/logger";
import { getQueueManager } from "../../../config/setup";
import { ApiErrors, getErrorMessage } from "../../errors";
import { sendTemplateNow } from "../../email";
import {
  DELIVERY_STATUS,
  NOTIFICATION_CHANNELS,
} from "../notifications.constants";
import type {
  IChannelDispatchContext,
  INotificationChannel,
} from "../notifications.types";

/**
 * Email channel. Resolves the recipient's email, asks the event's
 * `render.email` for subject + template variables, then either enqueues an
 * `email-delivery` job (with the `notification_delivery` row id threaded
 * through so the email worker can settle it on completion) or — when
 * queues are disabled / not yet booted — sends inline and settles the row
 * here.
 *
 * Events without an `email` render are skipped explicitly (the delivery row
 * is marked `suppressed`) instead of failing, since not every event has
 * email copy.
 */
class EmailChannel implements INotificationChannel {
  readonly name = NOTIFICATION_CHANNELS.EMAIL;

  async dispatch(ctx: IChannelDispatchContext): Promise<void> {
    const emailRender = ctx.event.render.email;

    if (!emailRender) {
      await this.markSuppressed(ctx.notificationId, "no_email_render");

      return;
    }

    const recipient = await this.lookupRecipient(ctx.recipientUserId);

    if (recipient === null) {
      await this.markFailed(ctx.notificationId, "recipient_user_not_found");

      throw ApiErrors.internal("Recipient user not found for email channel");
    }

    const deliveryId = await this.findDeliveryId(ctx.notificationId);

    if (deliveryId === null) {
      logger.warn("Email channel could not locate its delivery row", {
        event: "notifications.channel.email.delivery_missing",
        notificationId: ctx.notificationId,
      });

      return;
    }

    const subject = emailRender.subject({
      recipientUserId: ctx.recipientUserId,
      payload: ctx.payload,
    });
    const variables = emailRender.variables
      ? emailRender.variables({
          recipientUserId: ctx.recipientUserId,
          payload: ctx.payload,
        })
      : {};
    const input = {
      to: recipient.email,
      subject,
      templatePath: emailRender.templatePath,
      variables,
      notificationDeliveryId: deliveryId,
    };

    if (env.QUEUES_ENABLED) {
      const manager = getQueueManager();

      if (manager !== null) {
        await manager.enqueueEmailDelivery(input);

        return;
      }

      logger.warn(
        "QUEUES_ENABLED=true but QueueManager is not initialized; sending email inline",
        {
          event: "notifications.channel.email.queue_fallback_inline",
          notificationId: ctx.notificationId,
        }
      );
    }

    try {
      await sendTemplateNow(input);
      await this.markSent(deliveryId);
    } catch (error: unknown) {
      await this.markFailedById(deliveryId, getErrorMessage(error));

      throw error;
    }
  }

  private async lookupRecipient(
    userId: string
  ): Promise<{ email: string } | null> {
    const row = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { email: true },
    });

    return row ?? null;
  }

  private async findDeliveryId(notificationId: string): Promise<string | null> {
    const [row] = await db
      .select({ id: notificationDelivery.id })
      .from(notificationDelivery)
      .where(
        and(
          eq(notificationDelivery.notificationId, notificationId),
          eq(notificationDelivery.channel, NOTIFICATION_CHANNELS.EMAIL)
        )
      );

    return row?.id ?? null;
  }

  private async markSent(deliveryId: string): Promise<void> {
    const nowIso = now();

    await db
      .update(notificationDelivery)
      .set({
        status: DELIVERY_STATUS.SENT,
        sentAt: nowIso,
        updatedAt: nowIso,
      })
      .where(eq(notificationDelivery.id, deliveryId));
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
          eq(notificationDelivery.channel, NOTIFICATION_CHANNELS.EMAIL)
        )
      );
  }

  private async markFailedById(
    deliveryId: string,
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
      .where(eq(notificationDelivery.id, deliveryId));
  }

  private async markSuppressed(
    notificationId: string,
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
      .where(
        and(
          eq(notificationDelivery.notificationId, notificationId),
          eq(notificationDelivery.channel, NOTIFICATION_CHANNELS.EMAIL)
        )
      );
  }
}

export const emailChannel = new EmailChannel();
