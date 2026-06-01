import { logger } from "../../config/logger";
import {
  NOTIFICATION_DEDUP_CLEANUP_JOB_NAME,
  NOTIFICATION_DEDUP_CLEANUP_SCHEDULER_ID,
  NOTIFICATION_MAINTENANCE_DEFAULTS,
} from "./notification-maintenance.constants";
import { createNotificationMaintenanceQueue } from "./notification-maintenance.queue";
import type { INotificationMaintenanceSetupResult } from "./notification-maintenance.types";
import { createNotificationMaintenanceWorker } from "./notification-maintenance.worker";

/**
 * Boots the maintenance queue + worker and registers the recurring dedup
 * cleanup as a BullMQ job scheduler. Scheduler IDs are idempotent — calling
 * `upsertJobScheduler` on boot is safe even if a previous process left the
 * scheduler installed.
 */
export const setupNotificationMaintenanceQueue =
  async (): Promise<INotificationMaintenanceSetupResult> => {
    const queue = createNotificationMaintenanceQueue();
    const worker = createNotificationMaintenanceWorker();

    await queue.upsertJobScheduler(
      NOTIFICATION_DEDUP_CLEANUP_SCHEDULER_ID,
      { every: NOTIFICATION_MAINTENANCE_DEFAULTS.cleanupEveryMs },
      {
        name: NOTIFICATION_DEDUP_CLEANUP_JOB_NAME,
        data: {},
        opts: {
          attempts: NOTIFICATION_MAINTENANCE_DEFAULTS.attempts,
          backoff: {
            type: "exponential",
            delay: NOTIFICATION_MAINTENANCE_DEFAULTS.backoffDelayMs,
          },
          removeOnComplete: {
            age: NOTIFICATION_MAINTENANCE_DEFAULTS.removeOnCompleteAge,
            count: NOTIFICATION_MAINTENANCE_DEFAULTS.removeOnCompleteCount,
          },
          removeOnFail: false,
        },
      }
    );

    logger.info("✅ Notification maintenance queue initialized", {
      event: "queues.notification_maintenance.initialized",
      scheduler: NOTIFICATION_DEDUP_CLEANUP_SCHEDULER_ID,
      everyMs: NOTIFICATION_MAINTENANCE_DEFAULTS.cleanupEveryMs,
    });

    return { queue, worker };
  };
