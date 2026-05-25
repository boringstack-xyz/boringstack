import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./auth.schema";
import { notifications } from "./pg-schemas";

/**
 * Per-recipient notification record. One row per `(recipientUserId, eventType,
 * deduped-window)`. The `rendered` JSON is the pre-rendered in-app payload
 * the UI consumes verbatim — the backend owns the strings so the UI never
 * needs to know about event types.
 */
export const notification = notifications.table(
  "notification",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    recipientUserId: uuid("recipient_user_id").notNull(),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    payload: jsonb().notNull().default({}),
    rendered: jsonb().notNull(),
    status: varchar({ length: 20 }).notNull().default("unread"),
    readAt: timestamp("read_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_notification_recipient_status_created_at").on(
      table.recipientUserId,
      table.status,
      table.createdAt
    ),
    index("idx_notification_event_type").on(table.eventType),
    foreignKey({
      columns: [table.recipientUserId],
      foreignColumns: [users.id],
      name: "notification_recipient_user_id_fkey",
    }).onDelete("cascade"),
  ]
);

/**
 * Dedup ledger. Worker inserts a row keyed by `dedupKey` before persisting
 * a notification; a unique-constraint collision means an equivalent
 * notification fired inside the event's dedup window and the current one
 * is suppressed. A repeatable cleanup job purges rows past `expiresAt`.
 */
export const notificationDedup = notifications.table(
  "notification_dedup",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    dedupKey: varchar("dedup_key", { length: 255 }).notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("idx_notification_dedup_key_unique").on(table.dedupKey),
    index("idx_notification_dedup_expires_at").on(table.expiresAt),
  ]
);

/**
 * Per-channel delivery attempt. `status` flows pending → sent | failed |
 * suppressed. `attempts` counts retries; `error` captures the last failure
 * message. The `in-app` channel writes a row with `status: sent` immediately
 * (the notification row IS the delivery). Email + SSE rows transition
 * asynchronously as their downstream work completes.
 */
export const notificationDelivery = notifications.table(
  "notification_delivery",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    notificationId: uuid("notification_id").notNull(),
    channel: varchar({ length: 30 }).notNull(),
    status: varchar({ length: 20 }).notNull().default("pending"),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "string" }),
    failedAt: timestamp("failed_at", { withTimezone: true, mode: "string" }),
    error: text(),
    attempts: integer().notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_notification_delivery_notification_channel").on(
      table.notificationId,
      table.channel
    ),
    foreignKey({
      columns: [table.notificationId],
      foreignColumns: [notification.id],
      name: "notification_delivery_notification_id_fkey",
    }).onDelete("cascade"),
  ]
);

/**
 * Browser Web Push subscriptions per user. One row per (user, endpoint) —
 * the same user can subscribe from multiple devices/browsers. The
 * `web-push` channel reads this table at delivery time to fan out a
 * notification to every live subscription. Rows are deleted lazily when
 * the push service returns 410 Gone (subscription expired) or eagerly via
 * `DELETE /api/v1/notifications/push/subscribe` from the client.
 *
 * `endpoint` + `p256dhKey` + `authKey` are the three parts of a
 * PushSubscription as serialized by `PushSubscription.toJSON()` in the
 * browser. `userAgent` is captured at subscribe time only to render a
 * sensible "Chrome on macOS" label in the user's device list.
 */
export const pushSubscription = notifications.table(
  "push_subscription",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid("user_id").notNull(),
    endpoint: text().notNull(),
    p256dhKey: text("p256dh_key").notNull(),
    authKey: text("auth_key").notNull(),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    lastUsedAt: timestamp("last_used_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("idx_push_subscription_user_endpoint").on(
      table.userId,
      table.endpoint
    ),
    index("idx_push_subscription_user_id").on(table.userId),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "push_subscription_user_id_fkey",
    }).onDelete("cascade"),
  ]
);

/**
 * Per-user opt-in/out per `(eventType, channel)`. Missing rows fall back to
 * the event definition's `defaultChannels`. Existing rows with
 * `enabled: false` suppress dispatch on that channel and create a
 * `notification_delivery` row with `status: suppressed` for auditability.
 */
export const notificationPreference = notifications.table(
  "notification_preference",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid("user_id").notNull(),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    channel: varchar({ length: 30 }).notNull(),
    enabled: boolean().notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("idx_notification_preference_user_event_channel").on(
      table.userId,
      table.eventType,
      table.channel
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "notification_preference_user_id_fkey",
    }).onDelete("cascade"),
  ]
);
