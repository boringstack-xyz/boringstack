import { sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  primaryKey,
  serial,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { accounts } from "./app.schema";
import { billing } from "./pg-schemas";

export const plans = billing.table(
  "plans",
  {
    id: serial().primaryKey().notNull(),
    name: varchar({ length: 50 }).notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    stripePriceId: varchar("stripe_price_id", { length: 255 })
      .notNull()
      .default(""),
    stripeProductId: varchar("stripe_product_id", { length: 255 })
      .notNull()
      .default(""),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [unique("plans_name_key").on(table.name)]
);

/*
 * Plan ↔ feature mapping. Per-deployment overridable: seeds at boot
 * via `ensureConfiguredPlans` and operators can hand-edit rows.
 * `featureKey` is validated in code against the `FEATURES` catalog;
 * `value` is jsonb shaped as `{ bool: boolean }` for boolean features
 * and `{ number: number }` for limits.
 */
export const planFeatures = billing.table(
  "plan_features",
  {
    planId: integer("plan_id").notNull(),
    featureKey: varchar("feature_key", { length: 100 }).notNull(),
    value: jsonb().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.planId],
      foreignColumns: [plans.id],
      name: "plan_features_plan_id_fkey",
    }).onDelete("cascade"),
    primaryKey({
      columns: [table.planId, table.featureKey],
      name: "plan_features_pkey",
    }),
  ]
);

/*
 * Per-account subscription state. Stripe webhook is the source of
 * truth for paid status; admin grants land here with
 * `source = 'admin_grant'` and a populated `expiresAt`. Partial unique
 * index enforces "at most one current row per account" — superseded
 * rows are preserved with `revokedAt` set so the plan history can be
 * audited.
 *
 * Out-of-order webhook protection compares `(lastStripeEventAt,
 * lastStripeEventId)` per `(accountId, stripeSubscriptionId)`.
 */
export const accountPlans = billing.table(
  "account_plans",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    accountId: uuid("account_id").notNull(),
    planId: integer("plan_id").notNull(),
    status: varchar({ length: 32 }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", {
      withTimezone: true,
      mode: "string",
    }),
    source: varchar({ length: 32 }).notNull().default("stripe"),
    stripeSubscriptionId: varchar("stripe_subscription_id", {
      length: 255,
    }),
    stripeSubscriptionCreatedAt: timestamp("stripe_subscription_created_at", {
      withTimezone: true,
      mode: "string",
    }),
    lastStripeEventId: varchar("last_stripe_event_id", { length: 255 }),
    lastStripeEventAt: timestamp("last_stripe_event_at", {
      withTimezone: true,
      mode: "string",
    }),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp("revoked_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    index("idx_account_plans_account_id").on(table.accountId),
    index("idx_account_plans_status").on(table.status),
    uniqueIndex("uniq_account_plans_current")
      .on(table.accountId)
      .where(sql`revoked_at IS NULL`),
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [accounts.id],
      name: "account_plans_account_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.planId],
      foreignColumns: [plans.id],
      name: "account_plans_plan_id_fkey",
    }).onDelete("restrict"),
  ]
);

export const stripeWebhookEvents = billing.table("stripe_webhook_events", {
  eventId: varchar("event_id", { length: 255 }).primaryKey().notNull(),
  type: varchar({ length: 100 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});
