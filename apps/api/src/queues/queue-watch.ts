import type { Queue } from "bullmq";
import { watchValkeyQueue } from "../clients/valkey";
import { logger } from "../config/logger";

/**
 * Routes a queue's Valkey connection errors through the shared outage log
 * instead of letting each failed retry print. Returns the queue unchanged.
 */
export const watchQueueConnection = <TData>(
  queue: Queue<TData>,
  queueName: string
): Queue<TData> => {
  watchValkeyQueue(queue, `${queueName} queue`, (err: Error) => {
    logger.error("Queue error", {
      event: "queues.error",
      queue: queueName,
      error: err.message,
    });
  });

  return queue;
};
