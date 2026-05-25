import { Worker, type Job, type WorkerOptions } from "bullmq";
import { eq } from "drizzle-orm";
import webPush, { WebPushError } from "web-push";
import { db } from "../../clients/postgres";
import {
  notificationDelivery,
  pushSubscription,
} from "../../clients/postgres/schema";
import { BULL_PREFIX, getValkeyConnectionOptions } from "../../clients/valkey";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { ApiErrors, getErrorMessage } from "../../lib/errors";
import { DELIVERY_STATUS } from "../../lib/notifications/notifications.constants";
import { now } from "../../lib/time/now";
import {
  WEB_PUSH_DELIVERY_DEFAULTS,
  WEB_PUSH_DELIVERY_QUEUE_NAME,
} from "./web-push-delivery.constants";
import type { IWebPushDeliveryJobData } from "./web-push-delivery.types";

interface ISubscriptionRow {
  id: string;
  endpoint: string;
  p256dhKey: string;
  authKey: string;
}

interface IDeliveryResult {
  attempted: number;
  succeeded: number;
  pruned: number;
}

const HTTP_GONE = 410;
const HTTP_NOT_FOUND = 404;

const settleSent = async (
  deliveryId: string,
  attempts: number
): Promise<void> => {
  const nowIso = now();

  await db
    .update(notificationDelivery)
    .set({
      status: DELIVERY_STATUS.SENT,
      sentAt: nowIso,
      updatedAt: nowIso,
      attempts,
    })
    .where(eq(notificationDelivery.id, deliveryId));
};

const settleSuppressed = async (deliveryId: string): Promise<void> => {
  const nowIso = now();

  await db
    .update(notificationDelivery)
    .set({
      status: DELIVERY_STATUS.SUPPRESSED,
      updatedAt: nowIso,
      error: "no_live_subscriptions",
    })
    .where(eq(notificationDelivery.id, deliveryId));
};

const settleFailed = async (
  deliveryId: string,
  attempts: number
): Promise<void> => {
  const nowIso = now();

  await db
    .update(notificationDelivery)
    .set({
      status: DELIVERY_STATUS.FAILED,
      failedAt: nowIso,
      updatedAt: nowIso,
      attempts,
      error: "all_subscriptions_failed",
    })
    .where(eq(notificationDelivery.id, deliveryId));
};

/**
 * Settle the `notification_delivery` row based on how the per-subscription
 * fan-out played out. `sent` if any subscription accepted the payload;
 * `failed` if every attempt errored; `suppressed` when there were live
 * subscriptions at enqueue time but all of them were pruned by the time
 * the worker ran (e.g. the user revoked permission between events).
 */
const settleDelivery = async (
  deliveryId: string,
  result: IDeliveryResult
): Promise<void> => {
  if (result.succeeded > 0) {
    return settleSent(deliveryId, result.attempted);
  }

  if (result.attempted === 0 || result.pruned === result.attempted) {
    return settleSuppressed(deliveryId);
  }

  return settleFailed(deliveryId, result.attempted);
};

const shouldRetryTransientFailure = (
  job: Job<IWebPushDeliveryJobData>,
  result: IDeliveryResult
): boolean => {
  return (
    result.succeeded === 0 &&
    result.attempted > 0 &&
    result.pruned < result.attempted &&
    job.attemptsMade + 1 < WEB_PUSH_DELIVERY_DEFAULTS.attempts
  );
};

const loadSubscriptions = async (
  userId: string
): Promise<ISubscriptionRow[]> => {
  return db
    .select({
      id: pushSubscription.id,
      endpoint: pushSubscription.endpoint,
      p256dhKey: pushSubscription.p256dhKey,
      authKey: pushSubscription.authKey,
    })
    .from(pushSubscription)
    .where(eq(pushSubscription.userId, userId));
};

const pruneExpiredSubscription = async (
  subscriptionId: string
): Promise<void> => {
  await db
    .delete(pushSubscription)
    .where(eq(pushSubscription.id, subscriptionId));
};

const markUsed = async (subscriptionId: string): Promise<void> => {
  await db
    .update(pushSubscription)
    .set({ lastUsedAt: now() })
    .where(eq(pushSubscription.id, subscriptionId));
};

const isExpiredStatus = (status: number | undefined): boolean =>
  status === HTTP_GONE || status === HTTP_NOT_FOUND;

const buildPayload = (data: IWebPushDeliveryJobData): string =>
  JSON.stringify({
    title: data.title,
    body: data.body,
    url: data.url,
  });

const deliverToSubscription = async (
  subscription: ISubscriptionRow,
  payload: string,
  vapid: { subject: string; publicKey: string; privateKey: string }
): Promise<{ succeeded: boolean; pruned: boolean }> => {
  try {
    await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dhKey, auth: subscription.authKey },
      },
      payload,
      {
        vapidDetails: {
          subject: vapid.subject,
          publicKey: vapid.publicKey,
          privateKey: vapid.privateKey,
        },
      }
    );

    await markUsed(subscription.id);

    return { succeeded: true, pruned: false };
  } catch (error: unknown) {
    if (error instanceof WebPushError && isExpiredStatus(error.statusCode)) {
      logger.info("Pruned expired Web Push subscription", {
        event: "notifications.web_push.subscription_expired",
        subscriptionId: subscription.id,
        statusCode: error.statusCode,
      });
      await pruneExpiredSubscription(subscription.id);

      return { succeeded: false, pruned: true };
    }

    logger.warn("Web Push delivery to subscription failed", {
      event: "notifications.web_push.delivery_failed",
      subscriptionId: subscription.id,
      statusCode: error instanceof WebPushError ? error.statusCode : undefined,
      error: getErrorMessage(error),
    });

    return { succeeded: false, pruned: false };
  }
};

export class WebPushDeliveryWorker {
  private readonly worker: Worker<IWebPushDeliveryJobData>;

  constructor() {
    const options: WorkerOptions = {
      connection: getValkeyConnectionOptions(),
      prefix: BULL_PREFIX,
      concurrency: WEB_PUSH_DELIVERY_DEFAULTS.concurrency,
    };

    this.worker = new Worker<IWebPushDeliveryJobData>(
      WEB_PUSH_DELIVERY_QUEUE_NAME,
      this.processJob.bind(this),
      options
    );

    this.worker.on("completed", (job: Job<IWebPushDeliveryJobData>) => {
      logger.info("Web Push delivery job completed", {
        event: "notifications.web_push.job_completed",
        jobId: job.id,
        recipientUserId: job.data.recipientUserId,
      });
    });

    this.worker.on(
      "failed",
      (job: Job<IWebPushDeliveryJobData> | undefined, err: Error) => {
        logger.error("Web Push delivery job failed", {
          event: "notifications.web_push.job_failed",
          jobId: job?.id,
          attempts: job?.attemptsMade,
          error: err.message,
        });
      }
    );

    this.worker.on("error", (err: Error) => {
      logger.error("Web Push delivery worker error", {
        event: "notifications.web_push.worker_error",
        error: err.message,
      });
    });
  }

  private async processJob(job: Job<IWebPushDeliveryJobData>): Promise<void> {
    const subscriptions = await loadSubscriptions(job.data.recipientUserId);

    const result: IDeliveryResult = {
      attempted: subscriptions.length,
      succeeded: 0,
      pruned: 0,
    };

    if (subscriptions.length === 0) {
      await settleDelivery(job.data.notificationDeliveryId, result);

      return;
    }

    const payload = buildPayload(job.data);
    const vapid = {
      subject: env.WEB_PUSH_VAPID_SUBJECT,
      publicKey: env.WEB_PUSH_VAPID_PUBLIC,
      privateKey: env.WEB_PUSH_VAPID_PRIVATE,
    };

    for (const subscription of subscriptions) {
      const outcome = await deliverToSubscription(subscription, payload, vapid);

      if (outcome.succeeded) {
        result.succeeded += 1;
      }

      if (outcome.pruned) {
        result.pruned += 1;
      }
    }

    if (shouldRetryTransientFailure(job, result)) {
      throw ApiErrors.externalService(
        "Web Push delivery failed for every live subscription"
      );
    }

    await settleDelivery(job.data.notificationDeliveryId, result);
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}

export const createWebPushDeliveryWorker = (): WebPushDeliveryWorker =>
  new WebPushDeliveryWorker();
