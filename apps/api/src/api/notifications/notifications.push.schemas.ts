import { t } from "elysia";

/**
 * `PushSubscription.toJSON()` shape from the browser, transcribed verbatim.
 * `expirationTime` is `DOMHighResTimeStamp | null` in the spec; we accept it
 * as an optional number of milliseconds since epoch, or `null`.
 */
export const SubscribePushBodySchema = t.Object({
  endpoint: t.String({ minLength: 1, maxLength: 2048 }),
  keys: t.Object({
    p256dh: t.String({ minLength: 1, maxLength: 256 }),
    auth: t.String({ minLength: 1, maxLength: 256 }),
  }),
  expirationTime: t.Optional(t.Union([t.Number(), t.Null()])),
  userAgent: t.Optional(t.String({ maxLength: 512 })),
});

export const UnsubscribePushBodySchema = t.Object({
  endpoint: t.String({ minLength: 1, maxLength: 2048 }),
});

export const PublicPushSubscriptionSchema = t.Object({
  id: t.String(),
  endpoint: t.String(),
  userAgent: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
  lastUsedAt: t.String(),
});

export const PushSubscriptionsListResponse = t.Object({
  items: t.Array(PublicPushSubscriptionSchema),
});

export const SubscribePushResponse = t.Object({
  subscription: PublicPushSubscriptionSchema,
});

export const UnsubscribePushResponse = t.Object({
  removed: t.Number(),
});
