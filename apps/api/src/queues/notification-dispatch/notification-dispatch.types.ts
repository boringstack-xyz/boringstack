import type { Queue } from "bullmq";
import type { NotificationDispatchWorker } from "./notification-dispatch.worker";

/**
 * Job payload enqueued by the public `notifications.send(...)` entry point.
 * Payload is the event-specific data, validated against the event's
 * TypeBox schema at enqueue time. It's typed as `unknown` over the wire
 * because the worker is type-erased; the dispatch-job revalidates with
 * `Value.Check` before any user code touches it.
 */
export interface INotificationDispatchJobData {
  eventType: string;
  recipientUserId: string;
  payload: unknown;
  channelsOverride?: readonly string[];
}

export interface INotificationDispatchSetupResult {
  queue: Queue<INotificationDispatchJobData>;
  worker: NotificationDispatchWorker;
}
