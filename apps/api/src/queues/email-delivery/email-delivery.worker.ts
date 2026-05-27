import { now } from "../../lib/time/now";
import { Worker, type Job, type WorkerOptions } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "../../clients/postgres";
import { notificationDelivery } from "../../clients/postgres/schema";
import { BULL_PREFIX, getValkeyConnectionOptions } from "../../clients/valkey";
import { logger } from "../../config/logger";
import { getErrorMessage } from "../../lib/errors";
import { maskEmailForLogging, sendTemplateNow } from "../../lib/email";
import { DELIVERY_STATUS } from "../../lib/notifications/notifications.constants";
import {
  EMAIL_DELIVERY_DEFAULTS,
  EMAIL_DELIVERY_QUEUE_NAME,
} from "./email-delivery.constants";
import type { IEmailDeliveryJobData } from "./email-delivery.types";

export class EmailDeliveryWorker {
  private readonly worker: Worker<IEmailDeliveryJobData>;

  constructor() {
    const options: WorkerOptions = {
      connection: getValkeyConnectionOptions(),
      prefix: BULL_PREFIX,
      concurrency: EMAIL_DELIVERY_DEFAULTS.concurrency,
    };

    this.worker = new Worker<IEmailDeliveryJobData>(
      EMAIL_DELIVERY_QUEUE_NAME,
      this.processJob.bind(this),
      options
    );

    this.worker.on("completed", (job: Job<IEmailDeliveryJobData>) => {
      logger.info("Email delivery job completed", {
        event: "email_delivery_completed",
        jobId: job.id,
        templatePath: job.data.templatePath,
      });
    });

    this.worker.on(
      "failed",
      (job: Job<IEmailDeliveryJobData> | undefined, err: Error) => {
        logger.error("Email delivery job failed", {
          event: "email_delivery_failed",
          jobId: job?.id,
          attempts: job?.attemptsMade,
          templatePath: job?.data.templatePath,
          to: job ? maskEmailForLogging(job.data.to) : undefined,
          error: err.message,
        });

        if (job?.data.notificationDeliveryId !== undefined) {
          void markNotificationDeliveryFailed(
            job.data.notificationDeliveryId,
            err.message
          );
        }
      }
    );

    this.worker.on("error", (err: Error) => {
      logger.error("Email delivery worker error", {
        event: "email_delivery_worker_error",
        error: err.message,
      });
    });
  }

  private async processJob(job: Job<IEmailDeliveryJobData>): Promise<void> {
    const { to, subject, templatePath, variables, notificationDeliveryId } =
      job.data;

    logger.info("Processing email delivery job", {
      event: "email_delivery_processing",
      jobId: job.id,
      attempt: job.attemptsMade + 1,
      to: maskEmailForLogging(to),
      templatePath,
    });

    const outcome = await sendTemplateNow({
      to,
      subject,
      templatePath,
      variables,
    });

    if (notificationDeliveryId === undefined) {
      return;
    }

    if (outcome.status === "suppressed") {
      await markNotificationDeliverySuppressed(
        notificationDeliveryId,
        outcome.reason
      );

      return;
    }

    await markNotificationDeliverySent(notificationDeliveryId);
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}

export const createEmailDeliveryWorker = (): EmailDeliveryWorker =>
  new EmailDeliveryWorker();

const markNotificationDeliverySent = async (
  deliveryId: string
): Promise<void> => {
  try {
    const nowIso = now();

    await db
      .update(notificationDelivery)
      .set({
        status: DELIVERY_STATUS.SENT,
        sentAt: nowIso,
        updatedAt: nowIso,
      })
      .where(eq(notificationDelivery.id, deliveryId));
  } catch (error: unknown) {
    logger.error("Failed to settle notification_delivery to sent", {
      event: "email_delivery.settle_sent_failed",
      deliveryId,
      error: getErrorMessage(error),
    });
  }
};

const markNotificationDeliveryFailed = async (
  deliveryId: string,
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
      .where(eq(notificationDelivery.id, deliveryId));
  } catch (writeError: unknown) {
    logger.error("Failed to settle notification_delivery to failed", {
      event: "email_delivery.settle_failed_failed",
      deliveryId,
      error: getErrorMessage(writeError),
    });
  }
};

const markNotificationDeliverySuppressed = async (
  deliveryId: string,
  reason: string
): Promise<void> => {
  try {
    const nowIso = now();

    await db
      .update(notificationDelivery)
      .set({
        status: DELIVERY_STATUS.SUPPRESSED,
        updatedAt: nowIso,
        error: `recipient_suppressed:${reason}`,
      })
      .where(eq(notificationDelivery.id, deliveryId));
  } catch (writeError: unknown) {
    logger.error("Failed to settle notification_delivery to suppressed", {
      event: "email_delivery.settle_suppressed_failed",
      deliveryId,
      error: getErrorMessage(writeError),
    });
  }
};
