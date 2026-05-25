import { Worker, type Job, type WorkerOptions } from "bullmq";
import { BULL_PREFIX, getValkeyConnectionOptions } from "../../clients/valkey";
import { logger } from "../../config/logger";
import { runNotificationDispatch } from "../../lib/notifications";
import {
  NOTIFICATION_DISPATCH_DEFAULTS,
  NOTIFICATION_DISPATCH_QUEUE_NAME,
} from "./notification-dispatch.constants";
import type { INotificationDispatchJobData } from "./notification-dispatch.types";

/**
 * BullMQ adapter for the notifications dispatch pipeline. Job processing is
 * delegated to `runNotificationDispatch` — the same function the inline
 * fallback in `NotificationDispatcher` calls when `QUEUES_ENABLED=false`,
 * so the behaviour does not depend on topology.
 */
export class NotificationDispatchWorker {
  private readonly worker: Worker<INotificationDispatchJobData>;

  constructor() {
    const options: WorkerOptions = {
      connection: getValkeyConnectionOptions(),
      prefix: BULL_PREFIX,
      concurrency: NOTIFICATION_DISPATCH_DEFAULTS.concurrency,
    };

    this.worker = new Worker<INotificationDispatchJobData>(
      NOTIFICATION_DISPATCH_QUEUE_NAME,
      this.processJob.bind(this),
      options
    );

    this.worker.on("completed", (job: Job<INotificationDispatchJobData>) => {
      logger.info("Notification dispatch job completed", {
        event: "notification_dispatch_completed",
        jobId: job.id,
        eventType: job.data.eventType,
      });
    });

    this.worker.on(
      "failed",
      (job: Job<INotificationDispatchJobData> | undefined, err: Error) => {
        logger.error("Notification dispatch job failed", {
          event: "notification_dispatch_failed",
          jobId: job?.id,
          attempts: job?.attemptsMade,
          eventType: job?.data.eventType,
          error: err.message,
        });
      }
    );

    this.worker.on("error", (err: Error) => {
      logger.error("Notification dispatch worker error", {
        event: "notification_dispatch_worker_error",
        error: err.message,
      });
    });
  }

  private async processJob(
    job: Job<INotificationDispatchJobData>
  ): Promise<void> {
    logger.info("Processing notification dispatch job", {
      event: "notification_dispatch_processing",
      jobId: job.id,
      attempt: job.attemptsMade + 1,
      eventType: job.data.eventType,
      recipientUserId: job.data.recipientUserId,
    });

    await runNotificationDispatch({
      eventType: job.data.eventType,
      recipientUserId: job.data.recipientUserId,
      payload: job.data.payload,
      channelsOverride: job.data.channelsOverride,
    });
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}

export const createNotificationDispatchWorker =
  (): NotificationDispatchWorker => new NotificationDispatchWorker();
