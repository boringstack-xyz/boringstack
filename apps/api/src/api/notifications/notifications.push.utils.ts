import type {
  IPublicPushSubscription,
  IPushSubscriptionRow,
} from "./notifications.push.types";

/**
 * `PushSubscription.expirationTime` in the browser is a DOMHighResTimeStamp
 * (ms since epoch). DB column stores ISO; the convert is colocated here so
 * routes + service speak the same shape.
 */
export const expirationToIso = (
  value: number | null | undefined
): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  return new Date(value).toISOString();
};

/**
 * Strip the cryptographic secret fields before sending a subscription back
 * to the UI. `p256dhKey` + `authKey` are write-only — the browser already
 * has them, the UI doesn't need to see them again.
 */
export const toPublicPushSubscription = (
  row: IPushSubscriptionRow
): IPublicPushSubscription => ({
  id: row.id,
  endpoint: row.endpoint,
  userAgent: row.userAgent,
  createdAt: row.createdAt,
  lastUsedAt: row.lastUsedAt,
});
