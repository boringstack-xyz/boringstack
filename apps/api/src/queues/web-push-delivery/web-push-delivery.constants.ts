export const WEB_PUSH_DELIVERY_QUEUE_NAME = "web-push-delivery";

export const WEB_PUSH_DELIVERY_JOB_NAME = "deliver-web-push";

/**
 * Push services (FCM, Mozilla autopush, Apple Push) acknowledge or reject
 * within a few hundred milliseconds. A subscription that hasn't taken our
 * payload after a couple of retries is either temporarily congested
 * (re-attempt fine) or permanently gone (worker treats 410 as cleanup, not
 * retry). Long backoff windows would only delay the cleanup.
 */
export const WEB_PUSH_DELIVERY_DEFAULTS = {
  attempts: 3,
  backoffDelayMs: 30_000,
  removeOnCompleteAge: 3_600,
  removeOnCompleteCount: 100,
  concurrency: 5,
} as const;
