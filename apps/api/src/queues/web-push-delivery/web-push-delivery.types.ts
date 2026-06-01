import type { Queue } from "bullmq";
import type { WebPushDeliveryWorker } from "./web-push-delivery.worker";

/**
 * Payload the dispatcher hands to the worker. Subscriptions are resolved at
 * worker time (not enqueue time) so a new device that subscribes between
 * enqueue and execution still receives the notification.
 */
export interface IWebPushDeliveryJobData {
  recipientUserId: string;
  notificationDeliveryId: string;
  title: string;
  body: string;
  url: string | null;
}

export interface IWebPushDeliverySetupResult {
  queue: Queue<IWebPushDeliveryJobData>;
  worker: WebPushDeliveryWorker;
}
