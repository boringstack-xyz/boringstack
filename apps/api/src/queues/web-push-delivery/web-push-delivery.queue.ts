import { Queue, type QueueOptions } from "bullmq";
import { BULL_PREFIX, getValkeyConnectionOptions } from "../../clients/valkey";
import { watchQueueConnection } from "../queue-watch";
import { WEB_PUSH_DELIVERY_QUEUE_NAME } from "./web-push-delivery.constants";
import type { IWebPushDeliveryJobData } from "./web-push-delivery.types";

export const createWebPushDeliveryQueue =
  (): Queue<IWebPushDeliveryJobData> => {
    const config: QueueOptions = {
      connection: getValkeyConnectionOptions(),
      prefix: BULL_PREFIX,
    };

    return watchQueueConnection(
      new Queue<IWebPushDeliveryJobData>(WEB_PUSH_DELIVERY_QUEUE_NAME, config),
      WEB_PUSH_DELIVERY_QUEUE_NAME
    );
  };
