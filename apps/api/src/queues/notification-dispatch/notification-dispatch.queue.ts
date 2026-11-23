import { Queue, type QueueOptions } from "bullmq";
import { BULL_PREFIX, getValkeyConnectionOptions } from "../../clients/valkey";
import { watchQueueConnection } from "../queue-watch";
import { NOTIFICATION_DISPATCH_QUEUE_NAME } from "./notification-dispatch.constants";
import type { INotificationDispatchJobData } from "./notification-dispatch.types";

export const createNotificationDispatchQueue =
  (): Queue<INotificationDispatchJobData> => {
    const config: QueueOptions = {
      connection: getValkeyConnectionOptions(),
      prefix: BULL_PREFIX,
    };

    return watchQueueConnection(
      new Queue<INotificationDispatchJobData>(
        NOTIFICATION_DISPATCH_QUEUE_NAME,
        config
      ),
      NOTIFICATION_DISPATCH_QUEUE_NAME
    );
  };
