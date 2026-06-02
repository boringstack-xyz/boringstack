import type { JobsOptions, JobType } from "bullmq";
import { logger } from "../config/logger";
import type { IEmailDeliveryJobData } from "./email-delivery";
import {
  EMAIL_DELIVERY_DEFAULTS,
  EMAIL_DELIVERY_JOB_NAME,
} from "./email-delivery/email-delivery.constants";
import type { INotificationDispatchJobData } from "./notification-dispatch";
import {
  NOTIFICATION_DISPATCH_DEFAULTS,
  NOTIFICATION_DISPATCH_JOB_NAME,
} from "./notification-dispatch/notification-dispatch.constants";
import type { IQueueCounts, IQueueStats } from "./queue-stats.types";
import type { IWebPushDeliveryJobData } from "./web-push-delivery";
import {
  WEB_PUSH_DELIVERY_DEFAULTS,
  WEB_PUSH_DELIVERY_JOB_NAME,
} from "./web-push-delivery/web-push-delivery.constants";

/*
 * Structural views of the BullMQ surface the manager actually touches.
 * Real `Queue` / worker-class instances satisfy these implicitly; tests
 * satisfy them with plain stubs — no Valkey connection required.
 */
export interface IManagedWorker {
  close: () => Promise<void>;
}

export interface IManagedQueue {
  readonly name: string;
  getJobCounts: (...states: JobType[]) => Promise<Record<string, number>>;
  close: () => Promise<void>;
}

export interface IEnqueueableQueue<TData> extends IManagedQueue {
  add: (name: string, data: TData, opts?: JobsOptions) => Promise<unknown>;
}

interface IQueueManagerInput {
  accountMaintenanceQueue: IManagedQueue;
  accountMaintenanceWorker: IManagedWorker;
  emailDeliveryQueue: IEnqueueableQueue<IEmailDeliveryJobData>;
  emailDeliveryWorker: IManagedWorker;
  notificationDispatchQueue: IEnqueueableQueue<INotificationDispatchJobData>;
  notificationDispatchWorker: IManagedWorker;
  notificationMaintenanceQueue: IManagedQueue;
  notificationMaintenanceWorker: IManagedWorker;
  webPushDeliveryQueue: IEnqueueableQueue<IWebPushDeliveryJobData> | null;
  webPushDeliveryWorker: IManagedWorker | null;
}

const QUEUE_COUNT_STATES = [
  "waiting",
  "active",
  "completed",
  "failed",
  "delayed",
  "paused",
] as const;

const fetchQueueCounts = async (
  queue: IManagedQueue
): Promise<IQueueCounts> => {
  const counts = await queue.getJobCounts(...QUEUE_COUNT_STATES);

  return {
    waiting: counts.waiting ?? 0,
    active: counts.active ?? 0,
    completed: counts.completed ?? 0,
    failed: counts.failed ?? 0,
    delayed: counts.delayed ?? 0,
    paused: counts.paused ?? 0,
  };
};

/**
 * Centralized lifecycle + dispatch surface for every BullMQ queue in the
 * app. New queues should be added here so graceful shutdown,
 * application-level enqueue helpers, and admin stats stay in one place.
 *
 * The Web Push pair is nullable — the queue + worker are only constructed
 * when all three VAPID env vars are present. Callers handle the null case
 * by treating Web Push as a no-op (see `enqueueWebPushDelivery`).
 */
export class QueueManager {
  private readonly accountMaintenanceQueue: IManagedQueue;
  private readonly accountMaintenanceWorker: IManagedWorker;
  private readonly emailDeliveryQueue: IEnqueueableQueue<IEmailDeliveryJobData>;
  private readonly emailDeliveryWorker: IManagedWorker;
  private readonly notificationDispatchQueue: IEnqueueableQueue<INotificationDispatchJobData>;
  private readonly notificationDispatchWorker: IManagedWorker;
  private readonly notificationMaintenanceQueue: IManagedQueue;
  private readonly notificationMaintenanceWorker: IManagedWorker;
  private readonly webPushDeliveryQueue: IEnqueueableQueue<IWebPushDeliveryJobData> | null;
  private readonly webPushDeliveryWorker: IManagedWorker | null;

  constructor(input: IQueueManagerInput) {
    this.accountMaintenanceQueue = input.accountMaintenanceQueue;
    this.accountMaintenanceWorker = input.accountMaintenanceWorker;
    this.emailDeliveryQueue = input.emailDeliveryQueue;
    this.emailDeliveryWorker = input.emailDeliveryWorker;
    this.notificationDispatchQueue = input.notificationDispatchQueue;
    this.notificationDispatchWorker = input.notificationDispatchWorker;
    this.notificationMaintenanceQueue = input.notificationMaintenanceQueue;
    this.notificationMaintenanceWorker = input.notificationMaintenanceWorker;
    this.webPushDeliveryQueue = input.webPushDeliveryQueue;
    this.webPushDeliveryWorker = input.webPushDeliveryWorker;
  }

  async enqueueEmailDelivery(data: IEmailDeliveryJobData): Promise<void> {
    await this.emailDeliveryQueue.add(EMAIL_DELIVERY_JOB_NAME, data, {
      attempts: EMAIL_DELIVERY_DEFAULTS.attempts,
      backoff: {
        type: "exponential",
        delay: EMAIL_DELIVERY_DEFAULTS.backoffDelayMs,
      },
      removeOnComplete: {
        age: EMAIL_DELIVERY_DEFAULTS.removeOnCompleteAge,
        count: EMAIL_DELIVERY_DEFAULTS.removeOnCompleteCount,
      },
      removeOnFail: false,
    });
  }

  async enqueueWebPushDelivery(data: IWebPushDeliveryJobData): Promise<void> {
    if (this.webPushDeliveryQueue === null) {
      logger.warn(
        "Attempted Web Push enqueue without an initialized queue (VAPID env not set?)",
        {
          event: "queues.web_push_delivery.enqueue_skipped",
          recipientUserId: data.recipientUserId,
        }
      );

      return;
    }

    await this.webPushDeliveryQueue.add(WEB_PUSH_DELIVERY_JOB_NAME, data, {
      attempts: WEB_PUSH_DELIVERY_DEFAULTS.attempts,
      backoff: {
        type: "exponential",
        delay: WEB_PUSH_DELIVERY_DEFAULTS.backoffDelayMs,
      },
      removeOnComplete: {
        age: WEB_PUSH_DELIVERY_DEFAULTS.removeOnCompleteAge,
        count: WEB_PUSH_DELIVERY_DEFAULTS.removeOnCompleteCount,
      },
      removeOnFail: false,
    });
  }

  async enqueueNotificationDispatch(
    data: INotificationDispatchJobData
  ): Promise<void> {
    await this.notificationDispatchQueue.add(
      NOTIFICATION_DISPATCH_JOB_NAME,
      data,
      {
        attempts: NOTIFICATION_DISPATCH_DEFAULTS.attempts,
        backoff: {
          type: "exponential",
          delay: NOTIFICATION_DISPATCH_DEFAULTS.backoffDelayMs,
        },
        removeOnComplete: {
          age: NOTIFICATION_DISPATCH_DEFAULTS.removeOnCompleteAge,
          count: NOTIFICATION_DISPATCH_DEFAULTS.removeOnCompleteCount,
        },
        removeOnFail: false,
      }
    );
  }

  /**
   * Snapshot of every managed queue's job counts. Drives the admin
   * `/admin/queues` endpoint. Pure Valkey reads, safe from a request handler.
   */
  async getStats(): Promise<IQueueStats[]> {
    const queues: { name: string; queue: IManagedQueue }[] = [
      {
        name: this.accountMaintenanceQueue.name,
        queue: this.accountMaintenanceQueue,
      },
      { name: this.emailDeliveryQueue.name, queue: this.emailDeliveryQueue },
      {
        name: this.notificationDispatchQueue.name,
        queue: this.notificationDispatchQueue,
      },
      {
        name: this.notificationMaintenanceQueue.name,
        queue: this.notificationMaintenanceQueue,
      },
    ];

    if (this.webPushDeliveryQueue !== null) {
      queues.push({
        name: this.webPushDeliveryQueue.name,
        queue: this.webPushDeliveryQueue,
      });
    }

    return Promise.all(
      queues.map(async ({ name, queue }) => ({
        name,
        counts: await fetchQueueCounts(queue),
      }))
    );
  }

  async close(): Promise<void> {
    logger.info("Closing queues + workers", {
      event: "queues.shutdown.started",
    });

    const tasks: Promise<void>[] = [
      this.accountMaintenanceWorker.close(),
      this.accountMaintenanceQueue.close(),
      this.emailDeliveryWorker.close(),
      this.emailDeliveryQueue.close(),
      this.notificationDispatchWorker.close(),
      this.notificationDispatchQueue.close(),
      this.notificationMaintenanceWorker.close(),
      this.notificationMaintenanceQueue.close(),
    ];

    if (this.webPushDeliveryWorker !== null) {
      tasks.push(this.webPushDeliveryWorker.close());
    }

    if (this.webPushDeliveryQueue !== null) {
      tasks.push(this.webPushDeliveryQueue.close());
    }

    await Promise.all(tasks);

    logger.info("Queues + workers closed", {
      event: "queues.shutdown.completed",
    });
  }
}
