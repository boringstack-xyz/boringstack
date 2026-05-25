import { logger } from "../../config/logger";
import { createNotificationDispatchQueue } from "./notification-dispatch.queue";
import type { INotificationDispatchSetupResult } from "./notification-dispatch.types";
import { createNotificationDispatchWorker } from "./notification-dispatch.worker";

export const setupNotificationDispatchQueue =
  (): Promise<INotificationDispatchSetupResult> => {
    const queue = createNotificationDispatchQueue();
    const worker = createNotificationDispatchWorker();

    logger.info("✅ Notification dispatch queue initialized", {
      event: "queues.notification_dispatch.initialized",
    });

    return Promise.resolve({ queue, worker });
  };
