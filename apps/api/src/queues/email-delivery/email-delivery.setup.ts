import { logger } from "../../config/logger";
import { createEmailDeliveryQueue } from "./email-delivery.queue";
import type { IEmailDeliverySetupResult } from "./email-delivery.types";
import { createEmailDeliveryWorker } from "./email-delivery.worker";

export const setupEmailDeliveryQueue =
  (): Promise<IEmailDeliverySetupResult> => {
    const queue = createEmailDeliveryQueue();
    const worker = createEmailDeliveryWorker();

    logger.info("✅ Email delivery queue initialized", {
      event: "queues.email_delivery.initialized",
    });

    return Promise.resolve({ queue, worker });
  };
