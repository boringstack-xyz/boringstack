import {
  foreignKey,
  index,
  jsonb,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./auth.schema";
import { audit } from "./pg-schemas";

/**
 * Append-only event log of significant actions. Writes are fire-and-forget
 * from the application — `AuditLogService` swallows write errors so a
 * flaky audit table can never break a real request flow. `userId` is
 * nullable because system-initiated events (cron jobs, webhook handlers)
 * don't have an actor.
 *
 * Multi-tenant columns are nullable so platform-admin actions that have
 * no per-account membership still record the actor. `audit_log` is the
 * one schema that survives account hard-delete (GDPR redaction
 * tracked in `audit.redactions`).
 */
export const auditLog = audit.table(
  "audit_log",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid("user_id"),
    actorMembershipId: uuid("actor_membership_id"),
    targetAccountId: uuid("target_account_id"),
    targetUserId: uuid("target_user_id"),
    targetMembershipId: uuid("target_membership_id"),
    action: varchar({ length: 100 }).notNull(),
    resource: varchar({ length: 255 }),
    requestId: varchar("request_id", { length: 64 }),
    metadata: jsonb().notNull().default({}),
    ip: varchar({ length: 64 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_audit_log_user_id").on(table.userId),
    index("idx_audit_log_action").on(table.action),
    index("idx_audit_log_created_at").on(table.createdAt),
    index("idx_audit_log_target_account_id").on(table.targetAccountId),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "audit_log_user_id_fkey",
    }).onDelete("set null"),
  ]
);

/*
 * GDPR redaction trail. When a user exercises right-to-be-forgotten,
 * their `users` row is hard-deleted but their `audit_log` rows
 * survive with `actor_user_id` / `target_user_id` replaced by a
 * deterministic-but-anonymized hash. A `redactions` row records the
 * event so the forensic chain is preserved.
 */
export const redactions = audit.table(
  "redactions",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    originalUserIdHash: varchar("original_user_id_hash", {
      length: 64,
    }).notNull(),
    redactedAt: timestamp("redacted_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
    reason: varchar({ length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_redactions_original_user_id_hash").on(table.originalUserIdHash),
  ]
);
