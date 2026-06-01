import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  jsonb,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./auth.schema";
import { app } from "./pg-schemas";

/*
 * Accounts: the multi-tenant boundary. One Stripe customer per
 * account. Every account-scoped row in the rest of the app keys off
 * `accounts.id`. Soft-deleted via `deleted_at` with a 30-day grace
 * window before a background job hard-deletes the row and cascades to
 * everything `@account-scoped`.
 */
export const accounts = app.table(
  "accounts",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: varchar({ length: 200 }).notNull(),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    /*
     * Set when `ACCOUNT_DOMAIN_CLAIMING=true` and the founding user's
     * email had a non-public domain. Partial unique index below
     * enforces "one active account per claimed domain" — soft-deleted
     * accounts release their claim, so a fresh signup after a delete
     * gets the domain again.
     */
    claimedDomain: varchar("claimed_domain", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    index("idx_accounts_deleted_at").on(table.deletedAt),
    index("idx_accounts_claimed_domain").on(table.claimedDomain),
    uniqueIndex("uniq_accounts_claimed_domain_active")
      .on(table.claimedDomain)
      .where(sql`claimed_domain IS NOT NULL AND deleted_at IS NULL`),
    unique("accounts_stripe_customer_id_key").on(table.stripeCustomerId),
  ]
);

/*
 * Outstanding "your domain is already claimed — join the existing
 * account?" requests. Created at verify-email time when domain
 * claiming is on and the founder's domain matches an existing
 * account. Owner approves → the request becomes an active membership;
 * deny → the request rows out and the user has no account but stays
 * verified for future invitations.
 *
 * Status transitions are strict: pending → approved | denied. No
 * undo. Partial unique index prevents two pending requests for the
 * same (account, user).
 */
export const accountJoinRequests = app.table(
  "account_join_requests",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    accountId: uuid("account_id").notNull(),
    userId: uuid("user_id").notNull(),
    email: varchar({ length: 320 }).notNull(),
    status: varchar({ length: 16 }).notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    decidedAt: timestamp("decided_at", {
      withTimezone: true,
      mode: "string",
    }),
    decidedByUserId: uuid("decided_by_user_id"),
  },
  (table) => [
    index("idx_account_join_requests_account_id").on(table.accountId),
    index("idx_account_join_requests_user_id").on(table.userId),
    uniqueIndex("uniq_account_join_requests_pending")
      .on(table.accountId, table.userId)
      .where(sql`status = 'pending'`),
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [accounts.id],
      name: "account_join_requests_account_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "account_join_requests_user_id_fkey",
    }).onDelete("cascade"),
  ]
);

/*
 * Invitations to join an account. Single-use opaque token, hashed at
 * rest. Resend rotates `tokenHash` (the old emailed link becomes
 * invalid) and extends `expiresAt`. Revoke is a soft-delete via
 * `revokedAt`.
 */
export const accountInvitations = app.table(
  "account_invitations",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    accountId: uuid("account_id").notNull(),
    email: varchar({ length: 320 }).notNull(),
    roleToAssign: varchar("role_to_assign", { length: 32 }).notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    invitedByMembershipId: uuid("invited_by_membership_id"),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    acceptedAt: timestamp("accepted_at", {
      withTimezone: true,
      mode: "string",
    }),
    revokedAt: timestamp("revoked_at", {
      withTimezone: true,
      mode: "string",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_account_invitations_account_id").on(table.accountId),
    index("idx_account_invitations_email").on(table.email),
    index("idx_account_invitations_token_hash").on(table.tokenHash),
    /*
     * Partial unique on (accountId, lowercased email) WHERE the invitation
     * is still actionable. Prevents an account from accumulating multiple
     * concurrent open invitations for the same recipient — either malicious
     * spam or a buggy "Invite again" UI. Once an invitation is accepted or
     * revoked, the row exits the partial index so a follow-up invitation
     * is allowed.
     */
    uniqueIndex("uniq_account_invitations_active")
      .on(table.accountId, sql`lower(${table.email})`)
      .where(sql`accepted_at IS NULL AND revoked_at IS NULL`),
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [accounts.id],
      name: "account_invitations_account_id_fkey",
    }).onDelete("cascade"),
    unique("account_invitations_token_hash_key").on(table.tokenHash),
  ]
);

/*
 * Per-account feature overrides ("comps"). Resolution layer checks
 * here first; values shadow `plan_features` and the catalog default
 * (in code). Time-boundable via `expiresAt`; revoke is a soft-delete.
 * `granted_by_user_id` is always populated; `granted_by_membership_id`
 * is nullable for platform admins acting on accounts they're not a
 * member of. Partial unique index enforces "at most one active
 * override per (account, feature)".
 */
export const accountFeatureOverrides = app.table(
  "account_feature_overrides",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    accountId: uuid("account_id").notNull(),
    featureKey: varchar("feature_key", { length: 100 }).notNull(),
    value: jsonb().notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }),
    reason: text().notNull().default(""),
    visibility: varchar({ length: 16 }).notNull().default("internal"),
    grantedByUserId: uuid("granted_by_user_id").notNull(),
    grantedByMembershipId: uuid("granted_by_membership_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp("revoked_at", {
      withTimezone: true,
      mode: "string",
    }),
    revokedByUserId: uuid("revoked_by_user_id"),
    revokedReason: varchar("revoked_reason", { length: 64 }),
  },
  (table) => [
    index("idx_account_feature_overrides_account_id").on(table.accountId),
    index("idx_account_feature_overrides_feature_key").on(table.featureKey),
    uniqueIndex("uniq_account_feature_overrides_active")
      .on(table.accountId, table.featureKey)
      .where(sql`revoked_at IS NULL`),
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [accounts.id],
      name: "account_feature_overrides_account_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.grantedByUserId],
      foreignColumns: [users.id],
      name: "account_feature_overrides_granted_by_user_id_fkey",
    }).onDelete("restrict"),
  ]
);

/*
 * Two-step ownership transfer. The current owner initiates a transfer,
 * which inserts a pending row + hashed token; the email recipient
 * accepts or declines. Acceptance atomically demotes the current owner
 * and promotes the target, mirroring the single-step service's
 * invariant ("one active owner per account"). Tokens are opaque,
 * single-use, and TTL-bounded.
 *
 * Partial unique on (account_id) WHERE pending enforces at-most-one
 * outstanding offer per account — a follow-up "transfer again" surfaces
 * the existing offer instead of stacking.
 */
export const accountOwnershipTransfers = app.table(
  "account_ownership_transfers",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    accountId: uuid("account_id").notNull(),
    fromUserId: uuid("from_user_id").notNull(),
    toUserId: uuid("to_user_id").notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    acceptedAt: timestamp("accepted_at", {
      withTimezone: true,
      mode: "string",
    }),
    declinedAt: timestamp("declined_at", {
      withTimezone: true,
      mode: "string",
    }),
    cancelledAt: timestamp("cancelled_at", {
      withTimezone: true,
      mode: "string",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_account_ownership_transfers_account_id").on(table.accountId),
    index("idx_account_ownership_transfers_token_hash").on(table.tokenHash),
    uniqueIndex("uniq_account_ownership_transfers_pending")
      .on(table.accountId)
      .where(
        sql`accepted_at IS NULL AND declined_at IS NULL AND cancelled_at IS NULL`
      ),
    unique("account_ownership_transfers_token_hash_key").on(table.tokenHash),
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [accounts.id],
      name: "account_ownership_transfers_account_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.fromUserId],
      foreignColumns: [users.id],
      name: "account_ownership_transfers_from_user_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.toUserId],
      foreignColumns: [users.id],
      name: "account_ownership_transfers_to_user_id_fkey",
    }).onDelete("cascade"),
  ]
);
