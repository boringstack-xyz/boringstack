# Drizzle patterns

Read this when touching `src/clients/postgres/schema/**` or writing DB
queries inside a service.

## Schema files

Schema lives at `src/clients/postgres/schema/<feature>.schema.ts` (one
table per file). Every table has `createdAt` + `updatedAt` (enforced by
`drizzle-conventions/tables-must-have-timestamps`).

```ts
export const widgets = pgSchema("app").table("widgets", {
  id: uuid().defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  name: varchar({ length: 100 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});
```

## Migrations

Versioned: `bun run db:generate` (creates SQL) → `bun run db:migrate`
(applies) → commit the SQL. `bun run db:push` is a dev-only shortcut.

## Multi-step writes

The `db-transactions` plugin requires this:

```ts
await db.transaction(async (tx) => {
  await tx
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, user.id));
  await tx
    .insert(passwordResetTokens)
    .values({ userId: user.id, token, expiresAt });
});
```

Inside the callback, use `tx`, not `db`. Plain `db.<write>` inside a
`db.transaction(...)` is a known transaction-leak bug.

## Anti-patterns

- Raw SQL outside the allowlist (caught by
  `drizzle-conventions/no-raw-sql-outside-allowlist`).
- Importing the driver directly from a feature folder. Use the `db`
  re-export from `src/clients/postgres`.
