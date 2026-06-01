import { allEvents } from "../../api/notifications/events";
import {
  channelRegistry,
  emailChannel,
  eventRegistry,
  inAppChannel,
  sseChannel,
  webPushChannel,
} from "../../lib/notifications";
import { env } from "../env";
import { logger } from "../logger";

const isWebPushConfigured = (): boolean =>
  env.WEB_PUSH_VAPID_PUBLIC !== "" &&
  env.WEB_PUSH_VAPID_PRIVATE !== "" &&
  env.WEB_PUSH_VAPID_SUBJECT !== "";

/**
 * Process-wide notifications bootstrap. Registers the framework's channels
 * + any user-authored events. Always runs, regardless of `QUEUES_ENABLED`,
 * because the inline dispatch path (used when queues are disabled or while
 * tests run) depends on the same registries the worker uses.
 *
 * Each channel registers only when its prerequisites are present in the
 * environment — email always, SSE when Valkey-backed pub/sub is enabled,
 * Web Push when all three VAPID keys are configured. A fork that doesn't
 * ship a given channel never sees a non-functional entry in the registry.
 */
export const setupNotifications = (): void => {
  channelRegistry.register(inAppChannel);
  channelRegistry.register(emailChannel);

  if (env.NOTIFICATIONS_SSE_ENABLED) {
    channelRegistry.register(sseChannel);
  }

  if (isWebPushConfigured()) {
    channelRegistry.register(webPushChannel);
  }

  eventRegistry.registerAll(allEvents);

  logger.info("Notifications initialized", {
    event: "notifications_initialized",
    channels: channelRegistry.size(),
    events: eventRegistry.size(),
  });
};
