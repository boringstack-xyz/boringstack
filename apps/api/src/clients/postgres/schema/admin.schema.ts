import {
  index,
  integer,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { app } from "./pg-schemas";

/*
 * Operator-written email campaigns. One row per campaign; it moves once from
 * `draft` to `sending` to `sent`, so a double click cannot send it twice.
 * Only the operator dashboard writes here (`src/admin.ts`).
 */
export const emailCampaigns = app.table(
  "email_campaigns",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    subject: varchar({ length: 200 }).notNull(),
    body: text().notNull(),
    status: varchar({ length: 16 }).notNull().default("draft"),
    recipientCount: integer("recipient_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    createdByUserId: uuid("created_by_user_id"),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("idx_email_campaigns_created_at").on(table.createdAt)]
);

/*
 * One row per person a campaign was handed to. The unique pair is the
 * at-most-once guard: a retried send skips everyone already recorded.
 */
export const emailCampaignRecipients = app.table(
  "email_campaign_recipients",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    campaignId: uuid("campaign_id").notNull(),
    userId: uuid("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("email_campaign_recipients_campaign_user_key").on(
      table.campaignId,
      table.userId
    ),
  ]
);

/*
 * Resolve and snooze state for an operator action-feed item, keyed by the
 * item's stable key (for example `queue-failed:<name>`). `resolved` hides an
 * item until its count rises above `observedCount`; `snoozed` hides it until
 * `snoozedUntil`.
 */
export const adminFeedItemStates = app.table(
  "admin_feed_item_states",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    itemKey: varchar("item_key", { length: 200 }).notNull(),
    state: varchar({ length: 16 }).notNull(),
    observedCount: integer("observed_count").notNull().default(0),
    snoozedUntil: timestamp("snoozed_until", {
      withTimezone: true,
      mode: "string",
    }),
    actorUserId: uuid("actor_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [unique("admin_feed_item_states_item_key_key").on(table.itemKey)]
);
