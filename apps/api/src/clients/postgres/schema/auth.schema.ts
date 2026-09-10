import {
  bigint,
  boolean,
  foreignKey,
  index,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { auth } from "./pg-schemas";

export const users = auth.table(
  "users",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    email: varchar({ length: 255 }).notNull(),
    firstName: varchar("first_name", { length: 100 }).default("").notNull(),
    lastName: varchar("last_name", { length: 100 }).default("").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", {
      withTimezone: true,
      mode: "string",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    isPlatformAdmin: boolean("is_platform_admin").default(false).notNull(),
    /*
     * Three-column MFA state. All three are non-null together (enabled)
     * or all three null (disabled): there is no in-between persisted on
     * the row. Mid-enrollment state lives in Valkey, not here.
     *
     *   mfaEnabledAt        — non-null = TOTP required at login
     *   mfaSecretEncrypted  — AES-256-GCM ciphertext of the TOTP secret
     *   mfaLastTotpStep     — highest TOTP step accepted so far; rejects
     *                         replays inside the verification window
     */
    mfaEnabledAt: timestamp("mfa_enabled_at", {
      withTimezone: true,
      mode: "string",
    }),
    mfaSecretEncrypted: text("mfa_secret_encrypted"),
    mfaLastTotpStep: bigint("mfa_last_totp_step", { mode: "number" }),
  },
  (table) => [
    index("idx_users_email").on(table.email),
    index("idx_users_is_platform_admin").on(table.isPlatformAdmin),
    unique("users_email_key").on(table.email),
  ]
);

export const userAuthProviders = auth.table(
  "user_auth_providers",
  {
    id: serial().primaryKey().notNull(),
    userId: uuid("user_id").notNull(),
    provider: varchar({ length: 50 }).notNull(),
    providerUserId: varchar("provider_user_id", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 })
      .notNull()
      .default(""),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_user_auth_providers_provider_id").on(
      table.provider,
      table.providerUserId
    ),
    index("idx_user_auth_providers_user_id").on(table.userId),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "user_auth_providers_user_id_fkey",
    }).onDelete("cascade"),
    unique("user_auth_providers_provider_provider_user_id_key").on(
      table.provider,
      table.providerUserId
    ),
  ]
);

export const emailVerificationTokens = auth.table(
  "email_verification_tokens",
  {
    id: serial().primaryKey().notNull(),
    userId: uuid("user_id").notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_email_verification_tokens_token_hash").on(table.tokenHash),
    index("idx_email_verification_tokens_user_id").on(table.userId),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "email_verification_tokens_user_id_fkey",
    }).onDelete("cascade"),
    unique("email_verification_tokens_token_hash_key").on(table.tokenHash),
  ]
);

export const passwordResetTokens = auth.table(
  "password_reset_tokens",
  {
    id: serial().primaryKey().notNull(),
    userId: uuid("user_id").notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_password_reset_tokens_token_hash").on(table.tokenHash),
    index("idx_password_reset_tokens_user_id").on(table.userId),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "password_reset_tokens_user_id_fkey",
    }).onDelete("cascade"),
    unique("password_reset_tokens_token_hash_key").on(table.tokenHash),
  ]
);

export const mfaRecoveryCodes = auth.table(
  "mfa_recovery_codes",
  {
    id: serial().primaryKey().notNull(),
    userId: uuid("user_id").notNull(),
    /*
     * argon2id hash of a 10-character opaque code. We never persist the
     * plaintext; the user sees each code once on generation.
     */
    codeHash: text("code_hash").notNull(),
    usedAt: timestamp("used_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_mfa_recovery_codes_user_id").on(table.userId),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "mfa_recovery_codes_user_id_fkey",
    }).onDelete("cascade"),
  ]
);

/**
 * Every refresh-token hash a family has already retired.
 *
 * `auth.sessions` keeps two slots, `token_hash` and `previous_token_hash`,
 * which together detect a replay exactly one generation deep. This table
 * carries the rest of the chain, so a token captured any number of
 * rotations ago is still recognised as a replay: without it an attacker who
 * simply waits two rotations gets a generic "invalid session" — no family
 * revocation, no audit event, and the live token still working.
 *
 * A table rather than an array column on the session row: the lineage is
 * looked up on every refresh, an array would be scanned linearly, and it
 * would grow the hot row itself (a long-lived session rotates thousands of
 * times). Rows here die with their family — the FK cascades on the session
 * delete that revocation already performs.
 */
export const authSessionRetiredTokens = auth.table(
  "session_retired_tokens",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    sessionId: uuid("session_id").notNull(),
    familyId: uuid("family_id").notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("idx_session_retired_tokens_hash_unique").on(table.tokenHash),
    index("idx_session_retired_tokens_family_id").on(table.familyId),
    foreignKey({
      columns: [table.sessionId],
      foreignColumns: [authSessions.id],
      name: "session_retired_tokens_session_id_fkey",
    }).onDelete("cascade"),
  ]
);

export const authSessions = auth.table(
  "sessions",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid("user_id").notNull(),
    /*
     * Rotation chain identifier. Stays the same across every rotation of a
     * given login. On detected refresh-token replay, every row sharing this
     * familyId is deleted, killing the chain.
     */
    familyId: uuid("family_id").defaultRandom().notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    /*
     * Hash of the immediately preceding token in the rotation chain.
     * `session_retired_tokens` is the lookup replay detection reads, and it
     * covers every generation; this slot is the one-generation fallback
     * that keeps detection working through a rolling deploy, where an
     * instance on the previous build rotates a token and writes only here.
     */
    previousTokenHash: varchar("previous_token_hash", { length: 64 }),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("idx_sessions_token_hash_unique").on(table.tokenHash),
    index("idx_sessions_previous_token_hash").on(table.previousTokenHash),
    index("idx_sessions_family_id").on(table.familyId),
    index("idx_sessions_user_id").on(table.userId),
    index("idx_sessions_expires_at").on(table.expiresAt),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "sessions_user_id_fkey",
    }).onDelete("cascade"),
  ]
);
