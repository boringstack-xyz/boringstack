import type { Queue } from "bullmq";
import type { EmailDeliveryWorker } from "./email-delivery.worker";

export interface IEmailDeliveryJobData {
  to: string;
  subject: string;
  templatePath: string;
  variables?: Record<string, unknown>;
  /**
   * Optional reference to a `notification_delivery` row. When set, the
   * worker settles the row to `sent` / `failed` after the email send
   * completes — this is how the notifications subsystem tracks per-channel
   * delivery without coupling the email pipeline to the notifications
   * model surface.
   */
  notificationDeliveryId?: string;
}

export interface IEmailDeliverySetupResult {
  queue: Queue<IEmailDeliveryJobData>;
  worker: EmailDeliveryWorker;
}
