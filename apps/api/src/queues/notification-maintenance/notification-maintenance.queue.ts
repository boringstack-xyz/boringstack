import { Queue, type QueueOptions } from "bullmq";
import { BULL_PREFIX, getValkeyConnectionOptions } from "../../clients/valkey";
import { watchQueueConnection } from "../queue-watch";
import { NOTIFICATION_MAINTENANCE_QUEUE_NAME } from "./notification-maintenance.constants";
import type { INotificationMaintenanceJobData } from "./notification-maintenance.types";

export const createNotificationMaintenanceQueue =
  (): Queue<INotificationMaintenanceJobData> => {
    const config: QueueOptions = {
      connection: getValkeyConnectionOptions(),
      prefix: BULL_PREFIX,
    };

    return watchQueueConnection(
      new Queue<INotificationMaintenanceJobData>(
        NOTIFICATION_MAINTENANCE_QUEUE_NAME,
        config
      ),
      NOTIFICATION_MAINTENANCE_QUEUE_NAME
    );
  };
