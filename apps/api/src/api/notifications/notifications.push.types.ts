import type { InferSelectModel } from "drizzle-orm";
import type { pushSubscription } from "../../clients/postgres/schema";

export type IPushSubscriptionRow = InferSelectModel<typeof pushSubscription>;

/**
 * Public shape returned to the UI. The raw `p256dhKey` + `authKey` are
 * never echoed back — they're write-only secrets from the browser's
 * perspective. `endpoint` is exposed so the UI can render a "Devices"
 * list and let the user revoke a specific one.
 */
export interface IPublicPushSubscription {
  id: string;
  endpoint: string;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string;
}

export interface ISubscribePushInput {
  userId: string;
  endpoint: string;
  p256dhKey: string;
  authKey: string;
  expiresAt: string | null;
  userAgent: string | null;
}

export interface IUnsubscribePushInput {
  userId: string;
  endpoint: string;
}
