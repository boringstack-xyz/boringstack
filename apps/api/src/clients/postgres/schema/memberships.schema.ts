import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { accounts } from "./app.schema";
import { users } from "./auth.schema";
import { ROLE } from "../../../lib/acl/acl.constants";
import { auth } from "./pg-schemas";

/*
 * Per-(user, account) role assignments. A user can be `owner` of one
 * account and `viewer` of another; the JWT carries the active
 * membership's role. Soft-deleted via `revokedAt` so the audit trail
 * survives removal.
 *
 * Partial unique indexes enforce two invariants:
 *   1. At most one *active* membership per (account, user).
 *   2. At most one *active* owner per account.
 *
 * "Exactly one owner in steady state" is an application-level
 * invariant maintained by transactional creation + transfer logic.
 */
export const accountMemberships = auth.table(
  "account_memberships",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    accountId: uuid("account_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: varchar({ length: 32 }).notNull(),
    invitedByUserId: uuid("invited_by_user_id"),
    joinedAt: timestamp("joined_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
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
    revokedReason: varchar("revoked_reason", { length: 64 }),
  },
  (table) => [
    index("idx_account_memberships_account_id").on(table.accountId),
    index("idx_account_memberships_user_id").on(table.userId),
    uniqueIndex("uniq_account_memberships_active_user")
      .on(table.accountId, table.userId)
      .where(sql`revoked_at IS NULL`),
    uniqueIndex("uniq_account_memberships_active_owner")
      .on(table.accountId)
      .where(sql`role = ${ROLE.owner} AND revoked_at IS NULL`),
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [accounts.id],
      name: "account_memberships_account_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "account_memberships_user_id_fkey",
    }).onDelete("cascade"),
  ]
);
