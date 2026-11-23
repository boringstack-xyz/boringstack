import {
  foreignKey,
  index,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { accounts } from "./app.schema";
import { users } from "./auth.schema";
import { app } from "./pg-schemas";

/*
 * The one-question feedback prompt. One row per (user, moment): the unique
 * index makes a second tab, a reload or a race lose the claim, so a person
 * is asked at each moment at most once.
 */
export const feedbackAnswers = app.table(
  "feedback_answers",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    accountId: uuid("account_id").notNull(),
    userId: uuid("user_id").notNull(),
    moment: varchar({ length: 32 }).notNull(),
    state: varchar({ length: 16 }).notNull().default("shown"),
    answer: text().notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("uniq_feedback_answers_user_moment").on(
      table.userId,
      table.moment
    ),
    index("idx_feedback_answers_account_id").on(table.accountId),
    index("idx_feedback_answers_created_at").on(table.createdAt),
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [accounts.id],
      name: "feedback_answers_account_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "feedback_answers_user_id_fkey",
    }).onDelete("cascade"),
  ]
);
