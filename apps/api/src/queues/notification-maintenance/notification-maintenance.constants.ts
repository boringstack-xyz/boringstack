export const NOTIFICATION_MAINTENANCE_QUEUE_NAME = "notification-maintenance";

export const NOTIFICATION_DEDUP_CLEANUP_JOB_NAME = "dedup-cleanup";

/** The repeatable schedule id BullMQ uses to identify the job. */
export const NOTIFICATION_DEDUP_CLEANUP_SCHEDULER_ID = "dedup-cleanup-hourly";

/** The follow-up emails after sign-up (src/api/lifecycle). */
export const LIFECYCLE_NUDGES_JOB_NAME = "lifecycle-nudges";

export const LIFECYCLE_NUDGES_SCHEDULER_ID = "lifecycle-nudges-15m";

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
  /**
   * 15 minutes. Every stage window is days wide and each email is sent once
   * per person, so a late or missed tick only delays one.
   */
  lifecycleEveryMs: 900_000,
} as const;
