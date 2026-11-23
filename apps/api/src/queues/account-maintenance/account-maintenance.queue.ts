import { Queue, type QueueOptions } from "bullmq";
import { BULL_PREFIX, getValkeyConnectionOptions } from "../../clients/valkey";
import { watchQueueConnection } from "../queue-watch";
import { ACCOUNT_MAINTENANCE_QUEUE_NAME } from "./account-maintenance.constants";
import type { IAccountMaintenanceJobData } from "./account-maintenance.types";

export const createAccountMaintenanceQueue =
  (): Queue<IAccountMaintenanceJobData> => {
    const config: QueueOptions = {
      connection: getValkeyConnectionOptions(),
      prefix: BULL_PREFIX,
    };

    return watchQueueConnection(
      new Queue<IAccountMaintenanceJobData>(
        ACCOUNT_MAINTENANCE_QUEUE_NAME,
        config
      ),
      ACCOUNT_MAINTENANCE_QUEUE_NAME
    );
  };
