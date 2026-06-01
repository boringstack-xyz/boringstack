import { env } from "../../config/env";
import { getConfiguredOAuthProviders } from "../../lib/oauth";
import type { ICapabilities, ICapabilityEnv } from "./capabilities.types";

export const isWebPushConfigured = (source: ICapabilityEnv): boolean =>
  source.WEB_PUSH_VAPID_PUBLIC !== "" &&
  source.WEB_PUSH_VAPID_PRIVATE !== "" &&
  source.WEB_PUSH_VAPID_SUBJECT !== "";

export const buildCapabilities = (
  source: ICapabilityEnv = env
): ICapabilities => ({
  features: {
    notifications: {
      sse: source.NOTIFICATIONS_SSE_ENABLED,
      webPush: isWebPushConfigured(source),
    },
    billing: {
      enabled: source.BILLING_ENABLED,
    },
    ai: {
      enabled: source.AI_ENABLED,
    },
  },
  oauth: {
    providers: getConfiguredOAuthProviders(source),
  },
});
