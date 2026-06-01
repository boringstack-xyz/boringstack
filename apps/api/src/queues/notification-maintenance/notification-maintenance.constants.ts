export const NOTIFICATION_MAINTENANCE_QUEUE_NAME = "notification-maintenance";

export const NOTIFICATION_DEDUP_CLEANUP_JOB_NAME = "dedup-cleanup";

/** The repeatable schedule id BullMQ uses to identify the job. */
export const NOTIFICATION_DEDUP_CLEANUP_SCHEDULER_ID = "dedup-cleanup-hourly";

export const NOTIFICATION_MAINTENANCE_DEFAULTS = {
  attempts: 3,
  backoffDelayMs: 30_000,
  removeOnCompleteAge: 3_600,
  removeOnCompleteCount: 24,
  concurrency: 1,
  /**
   * 1 hour. Dedup rows have an event-supplied `expiresAt`; missing one
   * cleanup tick just delays GC by an hour, no correctness impact.
   */
  cleanupEveryMs: 3_600_000,
} as const;
