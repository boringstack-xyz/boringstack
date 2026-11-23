import { Queue } from "bullmq";
import { Redis } from "ioredis";

import { BULL_PREFIX, getValkeyConnectionOptions } from "../clients/valkey";
import { env } from "../config/env";
import { ACCOUNT_MAINTENANCE_QUEUE_NAME } from "./account-maintenance/account-maintenance.constants";
import { EMAIL_DELIVERY_QUEUE_NAME } from "./email-delivery/email-delivery.constants";
import { NOTIFICATION_DISPATCH_QUEUE_NAME } from "./notification-dispatch/notification-dispatch.constants";
import { NOTIFICATION_MAINTENANCE_QUEUE_NAME } from "./notification-maintenance/notification-maintenance.constants";
import { fetchQueueCounts, type IManagedQueue } from "./queue-manager";
import type { IQueueStats } from "./queue-stats.types";
import { WEB_PUSH_DELIVERY_QUEUE_NAME } from "./web-push-delivery/web-push-delivery.constants";

/*
 * Stats-only view of the queues for a process that runs no workers (the
 * LAN admin API). It opens plain BullMQ `Queue` handles, never a `Worker`
 * and never a scheduler, so it cannot consume or schedule a job. The
 * handles share one Valkey connection and are opened once per process.
 */

export type QueueOpener = (name: string) => IManagedQueue;

const isWebPushConfigured = (): boolean =>
  env.WEB_PUSH_VAPID_PUBLIC !== "" &&
  env.WEB_PUSH_VAPID_PRIVATE !== "" &&
  env.WEB_PUSH_VAPID_SUBJECT !== "";

export const readOnlyQueueNames = (includeWebPush: boolean): string[] => [
  ACCOUNT_MAINTENANCE_QUEUE_NAME,
  EMAIL_DELIVERY_QUEUE_NAME,
  NOTIFICATION_DISPATCH_QUEUE_NAME,
  NOTIFICATION_MAINTENANCE_QUEUE_NAME,
  ...(includeWebPush ? [WEB_PUSH_DELIVERY_QUEUE_NAME] : []),
];

interface IReadOnlyHandles {
  readonly open: QueueOpener;
  readonly handles: Map<string, IManagedQueue>;
}

/*
 * One ioredis client is handed to every Queue, so the process holds a
 * single Valkey connection however many queues it reads.
 */
const createSharedOpener = (): QueueOpener => {
  let connection: Redis | null = null;

  return (name) => {
    connection ??= new Redis(getValkeyConnectionOptions());

    return new Queue(name, { connection, prefix: BULL_PREFIX });
  };
};

let defaultHandles: IReadOnlyHandles | null = null;

const getDefaultHandles = (): IReadOnlyHandles => {
  defaultHandles ??= { open: createSharedOpener(), handles: new Map() };

  return defaultHandles;
};

export const getQueueStatsReadOnly = async (
  overrides: {
    open?: QueueOpener;
    includeWebPush?: boolean;
  } = {}
): Promise<IQueueStats[]> => {
  const state = overrides.open
    ? { open: overrides.open, handles: new Map<string, IManagedQueue>() }
    : getDefaultHandles();
  const names = readOnlyQueueNames(
    overrides.includeWebPush ?? isWebPushConfigured()
  );

  return Promise.all(
    names.map(async (name) => {
      let queue = state.handles.get(name);

      if (queue === undefined) {
        queue = state.open(name);
        state.handles.set(name, queue);
      }

      return { name, counts: await fetchQueueCounts(queue) };
    })
  );
};
