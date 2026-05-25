import {
  boolean,
  foreignKey,
  index,
  serial,
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
     * Hash of the immediately preceding token in the rotation chain. A
     * refresh request whose hash matches `previousTokenHash` (not
     * `tokenHash`) is a replay of an already-rotated token; the server
     * revokes the whole family.
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
