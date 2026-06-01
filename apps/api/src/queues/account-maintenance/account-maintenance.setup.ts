import { logger } from "../../config/logger";
import {
  ACCOUNT_MAINTENANCE_DEFAULTS,
  ACCOUNT_MAINTENANCE_JOB_NAME,
  ACCOUNT_MAINTENANCE_SCHEDULER_ID,
} from "./account-maintenance.constants";
import { createAccountMaintenanceQueue } from "./account-maintenance.queue";
import type { IAccountMaintenanceSetupResult } from "./account-maintenance.types";
import { createAccountMaintenanceWorker } from "./account-maintenance.worker";

/**
 * Boots the account lifecycle maintenance queue and registers its recurring
 * sweep. Calling this on every process boot is safe: BullMQ treats scheduler
 * IDs as stable upserts.
 */
export const setupAccountMaintenanceQueue =
  async (): Promise<IAccountMaintenanceSetupResult> => {
    const queue = createAccountMaintenanceQueue();
    const worker = createAccountMaintenanceWorker();

    await queue.upsertJobScheduler(
      ACCOUNT_MAINTENANCE_SCHEDULER_ID,
      { every: ACCOUNT_MAINTENANCE_DEFAULTS.sweepEveryMs },
      {
        name: ACCOUNT_MAINTENANCE_JOB_NAME,
        data: {},
        opts: {
          attempts: ACCOUNT_MAINTENANCE_DEFAULTS.attempts,
          backoff: {
            type: "exponential",
            delay: ACCOUNT_MAINTENANCE_DEFAULTS.backoffDelayMs,
          },
          removeOnComplete: {
            age: ACCOUNT_MAINTENANCE_DEFAULTS.removeOnCompleteAge,
            count: ACCOUNT_MAINTENANCE_DEFAULTS.removeOnCompleteCount,
          },
          removeOnFail: false,
        },
      }
    );

    logger.info("✅ Account maintenance queue initialized", {
      event: "queues.account_maintenance.initialized",
      scheduler: ACCOUNT_MAINTENANCE_SCHEDULER_ID,
      everyMs: ACCOUNT_MAINTENANCE_DEFAULTS.sweepEveryMs,
    });

    return { queue, worker };
  };
