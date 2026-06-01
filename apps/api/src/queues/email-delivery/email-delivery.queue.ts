import { Queue, type QueueOptions } from "bullmq";
import { BULL_PREFIX, getValkeyConnectionOptions } from "../../clients/valkey";
import { EMAIL_DELIVERY_QUEUE_NAME } from "./email-delivery.constants";
import type { IEmailDeliveryJobData } from "./email-delivery.types";

export const createEmailDeliveryQueue = (): Queue<IEmailDeliveryJobData> => {
  const config: QueueOptions = {
    connection: getValkeyConnectionOptions(),
    prefix: BULL_PREFIX,
  };

  return new Queue<IEmailDeliveryJobData>(EMAIL_DELIVERY_QUEUE_NAME, config);
};
