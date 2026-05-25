export const NOTIFICATION_DISPATCH_QUEUE_NAME = "notification-dispatch";

export const NOTIFICATION_DISPATCH_JOB_NAME = "dispatch-notification";

export const NOTIFICATION_DISPATCH_DEFAULTS = {
  attempts: 5,
  backoffDelayMs: 5_000,
  removeOnCompleteAge: 3_600,
  removeOnCompleteCount: 500,
  concurrency: 10,
} as const;
