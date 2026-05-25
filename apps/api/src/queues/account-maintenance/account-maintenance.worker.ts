import { Worker, type Job, type WorkerOptions } from "bullmq";
import { BULL_PREFIX, getValkeyConnectionOptions } from "../../clients/valkey";
import { logger } from "../../config/logger";
import {
  ACCOUNT_MAINTENANCE_DEFAULTS,
  ACCOUNT_MAINTENANCE_JOB_NAME,
  ACCOUNT_MAINTENANCE_QUEUE_NAME,
} from "./account-maintenance.constants";
import {
  cleanExpiredInvitationsJob,
  cleanStalePendingUsersJob,
  downgradeCanceledStripePlansJob,
  expireAdminPlansJob,
  expireFeatureOverridesJob,
  hardDeleteSoftDeletedAccountsJob,
} from "./account-maintenance.jobs";
import type {
  IAccountMaintenanceJobData,
  IAccountMaintenanceSweepResult,
} from "./account-maintenance.types";

const runAccountMaintenanceSweep =
  async (): Promise<IAccountMaintenanceSweepResult> => {
    const expiredFeatureOverrides = await expireFeatureOverridesJob();
    const expiredAdminPlans = await expireAdminPlansJob();
    const downgradedCanceledStripePlans =
      await downgradeCanceledStripePlansJob();
    const hardDeletedAccounts = await hardDeleteSoftDeletedAccountsJob();
    const cleanedPendingUsers = await cleanStalePendingUsersJob();
    const cleanedInvitations = await cleanExpiredInvitationsJob();

    return {
      expiredFeatureOverrides: expiredFeatureOverrides.swept,
      expiredAdminPlans: expiredAdminPlans.swept,
      downgradedCanceledStripePlans: downgradedCanceledStripePlans.swept,
      hardDeletedAccounts: hardDeletedAccounts.swept,
      cleanedPendingUsers: cleanedPendingUsers.swept,
      cleanedInvitations: cleanedInvitations.swept,
    };
  };

export class AccountMaintenanceWorker {
  private readonly worker: Worker<IAccountMaintenanceJobData>;

  constructor() {
    const options: WorkerOptions = {
      connection: getValkeyConnectionOptions(),
      prefix: BULL_PREFIX,
      concurrency: ACCOUNT_MAINTENANCE_DEFAULTS.concurrency,
    };

    this.worker = new Worker<IAccountMaintenanceJobData>(
      ACCOUNT_MAINTENANCE_QUEUE_NAME,
      this.processJob.bind(this),
      options
    );

    this.worker.on("completed", (job: Job<IAccountMaintenanceJobData>) => {
      logger.info("Account maintenance job completed", {
        event: "account_maintenance_completed",
        jobId: job.id,
        jobName: job.name,
      });
    });

    this.worker.on(
      "failed",
      (job: Job<IAccountMaintenanceJobData> | undefined, err: Error) => {
        logger.error("Account maintenance job failed", {
          event: "account_maintenance_failed",
          jobId: job?.id,
          jobName: job?.name,
          attempts: job?.attemptsMade,
          error: err.message,
        });
      }
    );

    this.worker.on("error", (err: Error) => {
      logger.error("Account maintenance worker error", {
        event: "account_maintenance_worker_error",
        error: err.message,
      });
    });
  }

  private async processJob(
    job: Job<IAccountMaintenanceJobData>
  ): Promise<void> {
    if (job.name === ACCOUNT_MAINTENANCE_JOB_NAME) {
      const result = await runAccountMaintenanceSweep();

      logger.info("Account maintenance sweep ran", {
        event: "account_maintenance.sweep.completed",
        ...result,
      });

      return;
    }

    logger.warn("Unknown account maintenance job name", {
      event: "account_maintenance_unknown_job",
      jobId: job.id,
      jobName: job.name,
    });
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}

export const createAccountMaintenanceWorker = (): AccountMaintenanceWorker =>
  new AccountMaintenanceWorker();
