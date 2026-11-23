import {
  foreignKey,
  index,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { accounts } from "./app.schema";
import { users } from "./auth.schema";
import { app } from "./pg-schemas";

/*
 * First-party product events the database cannot derive on its own (a
 * consented click, a limit reached). Written only for members who accepted
 * analytics, kinds come from an allowlist, and rows older than the retention
 * window are removed by the account-maintenance sweep.
 */
export const productEvents = app.table(
  "product_events",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    accountId: uuid("account_id").notNull(),
    userId: uuid("user_id").notNull(),
    kind: varchar({ length: 40 }).notNull(),
    context: varchar({ length: 40 }).notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_product_events_account_id_created_at").on(
      table.accountId,
      table.createdAt
    ),
    index("idx_product_events_created_at").on(table.createdAt),
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [accounts.id],
      name: "product_events_account_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "product_events_user_id_fkey",
    }).onDelete("cascade"),
  ]
);
