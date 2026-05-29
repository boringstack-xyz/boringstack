import { Worker, type Job, type WorkerOptions } from "bullmq";
import { BULL_PREFIX, getValkeyConnectionOptions } from "../../clients/valkey";
import { logger } from "../../config/logger";
import { dedupService } from "../../lib/notifications";
import { withQueueSpan } from "../../lib/tracing";
import {
  NOTIFICATION_DEDUP_CLEANUP_JOB_NAME,
  NOTIFICATION_MAINTENANCE_DEFAULTS,
  NOTIFICATION_MAINTENANCE_QUEUE_NAME,
} from "./notification-maintenance.constants";
import type { INotificationMaintenanceJobData } from "./notification-maintenance.types";

/**
 * Worker for periodic notifications maintenance routines. Branches on
 * `job.name` so a single worker covers every maintenance task — adding
 * new routines (archive purges, stats rollups) is just an extra case here.
 */
export class NotificationMaintenanceWorker {
  private readonly worker: Worker<INotificationMaintenanceJobData>;

  constructor() {
    const options: WorkerOptions = {
      connection: getValkeyConnectionOptions(),
      prefix: BULL_PREFIX,
      concurrency: NOTIFICATION_MAINTENANCE_DEFAULTS.concurrency,
    };

    this.worker = new Worker<INotificationMaintenanceJobData>(
      NOTIFICATION_MAINTENANCE_QUEUE_NAME,
      (job) =>
        withQueueSpan(NOTIFICATION_MAINTENANCE_QUEUE_NAME, job, () =>
          this.processJob(job)
        ),
      options
    );

    this.worker.on("completed", (job: Job<INotificationMaintenanceJobData>) => {
      logger.info("Notification maintenance job completed", {
        event: "notification_maintenance_completed",
        jobId: job.id,
        jobName: job.name,
      });
    });

    this.worker.on(
      "failed",
      (job: Job<INotificationMaintenanceJobData> | undefined, err: Error) => {
        logger.error("Notification maintenance job failed", {
          event: "notification_maintenance_failed",
          jobId: job?.id,
          jobName: job?.name,
          attempts: job?.attemptsMade,
          error: err.message,
        });
      }
    );

    this.worker.on("error", (err: Error) => {
      logger.error("Notification maintenance worker error", {
        event: "notification_maintenance_worker_error",
        error: err.message,
      });
    });
  }

  private async processJob(
    job: Job<INotificationMaintenanceJobData>
  ): Promise<void> {
    if (job.name === NOTIFICATION_DEDUP_CLEANUP_JOB_NAME) {
      const deleted = await dedupService.purgeExpired();

      logger.info("Notification dedup cleanup ran", {
        event: "notifications.dedup.cleanup.completed",
        deletedRows: deleted,
      });

      return;
    }

    logger.warn("Unknown notification maintenance job name", {
      event: "notification_maintenance_unknown_job",
      jobId: job.id,
      jobName: job.name,
    });
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}

export const createNotificationMaintenanceWorker =
  (): NotificationMaintenanceWorker => new NotificationMaintenanceWorker();
