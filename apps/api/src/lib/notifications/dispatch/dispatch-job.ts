import { now } from "../../time/now";
import { Value } from "@sinclair/typebox/value";
import { and, eq } from "drizzle-orm";
import { db } from "../../../clients/postgres";
import {
  notification,
  notificationDelivery,
} from "../../../clients/postgres/schema";
import { logger } from "../../../config/logger";
import { ApiErrors, getErrorMessage } from "../../errors";
import { channelRegistry } from "../channels/channel-registry";
import { dedupService } from "../dedup.service";
import { eventRegistry } from "../events/event-registry";
import {
  DELIVERY_STATUS,
  NOTIFICATION_STATUS,
} from "../notifications.constants";
import type {
  IChannelDispatchContext,
  IRegisteredEvent,
  IRenderedNotification,
} from "../notifications.types";
import { notificationPreferencesService } from "../preferences/preferences.service";
import type {
  IDispatchJob,
  IDispatchResult,
  IFanOutInput,
  IPersistInput,
} from "./dispatch-job.types";

/**
 * Core dispatch path. Looks up the event, validates the payload, runs
 * dedup + self-action guards, persists the notification + per-channel
 * `notification_delivery` rows in a single transaction, then fans out to
 * channel handlers outside the transaction (channel side effects shouldn't
 * hold a DB lock).
 *
 * Throws on validation failure so the BullMQ retry envelope captures it;
 * dedup hits and self-action skips return early without throwing because
 * those are expected outcomes, not failures.
 */
export const runNotificationDispatch = async (
  job: IDispatchJob
): Promise<IDispatchResult> => {
  const event = eventRegistry.get(job.eventType);

  if (!event) {
    logger.warn("Unknown notification event type", {
      event: "notifications.dispatch.unknown_event",
      eventType: job.eventType,
    });

    return { outcome: "unknown_event" };
  }

  if (!Value.Check(event.schema, job.payload)) {
    const errors = [...Value.Errors(event.schema, job.payload)].map((err) => ({
      path: err.path,
      message: err.message,
    }));

    logger.error("Notification payload failed schema validation", {
      event: "notifications.dispatch.invalid_payload",
      eventType: job.eventType,
      errors,
    });

    throw ApiErrors.internal(
      `Notification payload for "${job.eventType}" failed schema validation`
    );
  }

  const ctx = {
    recipientUserId: job.recipientUserId,
    payload: job.payload,
  };

  if (event.selfActionGuard?.(ctx) === true) {
    logger.info("Notification skipped by self-action guard", {
      event: "notifications.dispatch.self_action_skipped",
      eventType: job.eventType,
      recipientUserId: job.recipientUserId,
    });

    return { outcome: "self_action_skipped" };
  }

  if (event.dedup) {
    const claimed = await dedupService.tryClaim({
      dedupKey: event.dedup.key(ctx),
      windowSeconds: event.dedup.windowSeconds,
    });

    if (!claimed) {
      logger.info("Notification deduplicated", {
        event: "notifications.dispatch.deduplicated",
        eventType: job.eventType,
        recipientUserId: job.recipientUserId,
      });

      return { outcome: "deduplicated" };
    }
  }

  const candidates = pickChannels(event, job.channelsOverride);
  const resolved = await notificationPreferencesService.resolveEnabledChannels({
    userId: job.recipientUserId,
    eventType: job.eventType,
    candidates,
  });
  const rendered = renderInApp(event, ctx);

  const notificationId = await persistNotificationRow({
    recipientUserId: job.recipientUserId,
    eventType: job.eventType,
    payload: job.payload,
    rendered,
    enabledChannels: resolved.enabled,
    disabledChannels: resolved.disabled,
  });

  await fanOutToChannels({
    notificationId,
    recipientUserId: job.recipientUserId,
    event,
    payload: job.payload,
    rendered,
    channels: resolved.enabled,
  });

  logger.info("Notification dispatched", {
    event: "notifications.dispatch.completed",
    eventType: job.eventType,
    recipientUserId: job.recipientUserId,
    notificationId,
    enabledChannels: resolved.enabled,
    disabledChannels: resolved.disabled,
  });

  return { outcome: "dispatched", notificationId };
};

const pickChannels = (
  event: IRegisteredEvent,
  channelsOverride: readonly string[] | undefined
): readonly string[] => {
  if (channelsOverride !== undefined) {
    return channelsOverride;
  }

  return event.defaultChannels;
};

const renderInApp = (
  event: IRegisteredEvent,
  ctx: { recipientUserId: string; payload: unknown }
): IRenderedNotification => {
  if (event.render.inApp) {
    return event.render.inApp(ctx);
  }

  /*
   * Fallback for events that only render to email — UI still needs *some*
   * strings if a row lands in the in-app list later.
   */
  return {
    title: event.type,
    body: "",
  };
};

const persistNotificationRow = async (
  input: IPersistInput
): Promise<string> => {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(notification)
      .values({
        recipientUserId: input.recipientUserId,
        eventType: input.eventType,
        payload: toJsonbValue(input.payload),
        rendered: { ...input.rendered },
        status: NOTIFICATION_STATUS.UNREAD,
      })
      .returning({ id: notification.id });

    if (!row) {
      throw ApiErrors.internal("Failed to insert notification row");
    }

    const deliveryRows: {
      notificationId: string;
      channel: string;
      status: string;
      error?: string;
    }[] = [];

    for (const channel of input.enabledChannels) {
      deliveryRows.push({
        notificationId: row.id,
        channel,
        status: DELIVERY_STATUS.PENDING,
      });
    }

    for (const channel of input.disabledChannels) {
      deliveryRows.push({
        notificationId: row.id,
        channel,
        status: DELIVERY_STATUS.SUPPRESSED,
        error: "preference_disabled",
      });
    }

    if (deliveryRows.length > 0) {
      await tx.insert(notificationDelivery).values(deliveryRows);
    }

    return row.id;
  });
};

const toJsonbValue = (payload: unknown): Record<string, unknown> => {
  if (
    typeof payload === "object" &&
    payload !== null &&
    !Array.isArray(payload)
  ) {
    const copy: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(payload)) {
      copy[key] = value;
    }

    return copy;
  }

  return { value: payload };
};

const fanOutToChannels = async (input: IFanOutInput): Promise<void> => {
  const handlers: { channel: string; ctx: IChannelDispatchContext }[] = [];

  for (const channelName of input.channels) {
    const impl = channelRegistry.get(channelName);

    if (!impl) {
      logger.warn("No channel registered for notification dispatch", {
        event: "notifications.dispatch.channel_missing",
        channelName,
        notificationId: input.notificationId,
      });
      await markDeliveryFailed(
        input.notificationId,
        channelName,
        "channel_not_registered"
      );
      continue;
    }

    handlers.push({
      channel: channelName,
      ctx: {
        notificationId: input.notificationId,
        recipientUserId: input.recipientUserId,
        event: input.event,
        payload: input.payload,
        rendered: input.rendered,
      },
    });
  }

  const results = await Promise.allSettled(
    handlers.map(async ({ channel, ctx }) => {
      const impl = channelRegistry.get(channel);

      if (!impl) {
        return;
      }

      try {
        await impl.dispatch(ctx);
      } catch (error: unknown) {
        await markDeliveryFailed(
          input.notificationId,
          channel,
          getErrorMessage(error)
        );

        throw error;
      }
    })
  );

  /*
   * Log rejected promises but never re-throw — a single failing channel
   * (e.g. email provider down) must not break others.
   */
  results.forEach((result, idx) => {
    if (result.status !== "rejected") {
      return;
    }

    const channel = handlers[idx]?.channel ?? "unknown";

    logger.error("Channel dispatch rejected", {
      event: "notifications.dispatch.channel_rejected",
      channelName: channel,
      notificationId: input.notificationId,
      error: getErrorMessage(result.reason),
    });
  });
};

const markDeliveryFailed = async (
  notificationId: string,
  channelName: string,
  error: string
): Promise<void> => {
  try {
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
          eq(notificationDelivery.channel, channelName)
        )
      );
  } catch (writeError: unknown) {
    logger.error("Failed to mark notification delivery failed", {
      event: "notifications.dispatch.mark_failed_error",
      notificationId,
      channelName,
      error: getErrorMessage(writeError),
    });
  }
};
