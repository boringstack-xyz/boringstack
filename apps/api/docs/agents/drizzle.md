# Drizzle patterns

Read this when touching `src/clients/postgres/schema/**` or writing DB
queries inside a service.

## Schema files

Schema lives at `src/clients/postgres/schema/<feature>.schema.ts` (one
table per file). Every table has `createdAt` + `updatedAt` (enforced by
`drizzle-conventions/tables-must-have-timestamps`).

```ts
export const tickets = pgSchema("app").table("tickets", {
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

## Typing relational results

`InferSelectModel<typeof components>` covers a base row only. For a
`db.query.x.findMany({ with })` result, derive the type from the query
function instead of composing it by hand, so the `with` clause and the type
never drift:

```ts
export const listWithRelations = () =>
  db.query.components.findMany({
    with: { terminals: true, manufacturer: true },
  });

export type IComponentWithRelations = Awaited<
  ReturnType<typeof listWithRelations>
>[number];
```

Pure mappers take `IComponentWithRelations`; the repository function is the
single owner of the shape. Two column-type reminders for the same mappers:
Postgres `numeric` / `decimal` arrive as `string` (convert at the mapper, or
declare the column `{ mode: "number" }` when precision allows), and `bigint`
arrives as `string` unless the column is declared `{ mode: "number" }`.

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
  `drizzle-conventions/no-raw-sql-outside-allowlist`). The one shape the
  rule accepts anywhere is column arithmetic, the atomic counter:
  `set({ viewCount: sql\`${links.viewCount} + 1\` })`. Any literal text
  beyond operators and numbers, or a hole that is not a column reference,
  is still a raw query.
- Importing the driver directly from a feature folder. Use the `db`
  re-export from `src/clients/postgres`.
