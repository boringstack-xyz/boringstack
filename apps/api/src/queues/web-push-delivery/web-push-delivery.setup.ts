import { logger } from "../../config/logger";
import { createWebPushDeliveryQueue } from "./web-push-delivery.queue";
import type { IWebPushDeliverySetupResult } from "./web-push-delivery.types";
import { createWebPushDeliveryWorker } from "./web-push-delivery.worker";

export const setupWebPushDeliveryQueue =
  (): Promise<IWebPushDeliverySetupResult> => {
    const queue = createWebPushDeliveryQueue();
    const worker = createWebPushDeliveryWorker();

    logger.info("✅ Web Push delivery queue initialized", {
      event: "queues.web_push_delivery.initialized",
    });

    return Promise.resolve({ queue, worker });
  };
