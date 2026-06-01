import { logger } from "../logger";
import { env } from "../env";
import {
  QueueManager,
  setupAccountMaintenanceQueue,
  setupEmailDeliveryQueue,
  setupNotificationDispatchQueue,
  setupNotificationMaintenanceQueue,
  setupWebPushDeliveryQueue,
} from "../../queues";

let queueManager: QueueManager | null = null;

const isWebPushConfigured = (): boolean =>
  env.WEB_PUSH_VAPID_PUBLIC !== "" &&
  env.WEB_PUSH_VAPID_PRIVATE !== "" &&
  env.WEB_PUSH_VAPID_SUBJECT !== "";

export const setupQueues = async (): Promise<QueueManager> => {
  if (queueManager !== null) {
    return queueManager;
  }

  const [
    accountMaintenance,
    emailDelivery,
    notificationDispatch,
    notificationMaintenance,
  ] = await Promise.all([
    setupAccountMaintenanceQueue(),
    setupEmailDeliveryQueue(),
    setupNotificationDispatchQueue(),
    setupNotificationMaintenanceQueue(),
  ]);

  const webPushDelivery = isWebPushConfigured()
    ? await setupWebPushDeliveryQueue()
    : null;

  queueManager = new QueueManager({
    accountMaintenanceQueue: accountMaintenance.queue,
    accountMaintenanceWorker: accountMaintenance.worker,
    emailDeliveryQueue: emailDelivery.queue,
    emailDeliveryWorker: emailDelivery.worker,
    notificationDispatchQueue: notificationDispatch.queue,
    notificationDispatchWorker: notificationDispatch.worker,
    notificationMaintenanceQueue: notificationMaintenance.queue,
    notificationMaintenanceWorker: notificationMaintenance.worker,
    webPushDeliveryQueue: webPushDelivery?.queue ?? null,
    webPushDeliveryWorker: webPushDelivery?.worker ?? null,
  });

  const initialized = [
    "account-maintenance",
    "email-delivery",
    "notification-dispatch",
    "notification-maintenance",
  ];

  if (webPushDelivery !== null) {
    initialized.push("web-push-delivery");
  }

  logger.info("✅ Queues initialized", {
    event: "queues_initialized",
    queues: initialized,
  });

  return queueManager;
};

/**
 * Returns the active QueueManager when queues are enabled, otherwise null.
 * Callers must handle the null case (e.g. fall back to inline execution).
 */
export const getQueueManager = (): QueueManager | null => queueManager;
