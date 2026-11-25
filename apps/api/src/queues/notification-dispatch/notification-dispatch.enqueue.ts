import type { Queue } from "bullmq";

import { createNotificationDispatchQueue } from "./notification-dispatch.queue";
import {
  NOTIFICATION_DISPATCH_DEFAULTS,
  NOTIFICATION_DISPATCH_JOB_NAME,
} from "./notification-dispatch.constants";
import type { INotificationDispatchJobData } from "./notification-dispatch.types";

/*
 * Producer-only handle for processes that do not boot the QueueManager, such
 * as the LAN-only admin process. It enqueues onto the same queue and with the
 * same job options as QueueManager.enqueueNotificationDispatch, so the public
 * process's worker delivers the job. It never starts a worker.
 */
let producer: Queue<INotificationDispatchJobData> | null = null;

/**
 * `jobId` makes a second enqueue of the same logical send a no-op, which is
 * the caller's dedup for a retried request.
 */
export const enqueueNotificationDispatchJob = async (
  data: INotificationDispatchJobData,
  jobId?: string
): Promise<void> => {
  producer ??= createNotificationDispatchQueue();

  await producer.add(NOTIFICATION_DISPATCH_JOB_NAME, data, {
    ...(jobId === undefined ? {} : { jobId }),
    attempts: NOTIFICATION_DISPATCH_DEFAULTS.attempts,
    backoff: {
      type: "exponential",
      delay: NOTIFICATION_DISPATCH_DEFAULTS.backoffDelayMs,
    },
    removeOnComplete: {
      age: NOTIFICATION_DISPATCH_DEFAULTS.removeOnCompleteAge,
      count: NOTIFICATION_DISPATCH_DEFAULTS.removeOnCompleteCount,
    },
    removeOnFail: false,
  });
};
