export const ACCOUNT_MAINTENANCE_QUEUE_NAME = "account-maintenance";

export const ACCOUNT_MAINTENANCE_JOB_NAME = "run-account-maintenance";

/** The repeatable schedule id BullMQ uses to identify the job. */
export const ACCOUNT_MAINTENANCE_SCHEDULER_ID = "account-maintenance-hourly";

export const ACCOUNT_MAINTENANCE_DEFAULTS = {
  attempts: 3,
  backoffDelayMs: 30_000,
  removeOnCompleteAge: 3_600,
  removeOnCompleteCount: 24,
  concurrency: 1,
  /**
   * 1 hour. These sweeps are all idempotent maintenance routines; a missed
   * tick only delays cleanup and expiration work until the next scheduler run.
   */
  sweepEveryMs: 3_600_000,
} as const;
