export const EMAIL_DELIVERY_QUEUE_NAME = "email-delivery";

export const EMAIL_DELIVERY_JOB_NAME = "send-template";

export const EMAIL_DELIVERY_DEFAULTS = {
  attempts: 5,
  backoffDelayMs: 5_000,
  removeOnCompleteAge: 3_600,
  removeOnCompleteCount: 100,
  concurrency: 5,
} as const;
