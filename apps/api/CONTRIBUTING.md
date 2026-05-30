# Contributing

This template assumes most code is written by AI agents. The conventions
exist so `bun run check` is a reliable signal.

## Adding a feature

Each feature lives at `src/api/<Feature>/`:

```
tickets/
├── tickets.routes.ts     # Elysia route group (HTTP only)
├── tickets.service.ts    # business logic, Drizzle
├── tickets.schemas.ts    # TypeBox request/response shapes
└── tickets.types.ts      # types inferred from db schema
```

Routes never query the DB directly. Services never touch `t.*`. Import
boundaries are enforced by the `resource-architecture` and
`module-boundaries` ESLint plugins.

### 1. Schema

Add the table to `src/clients/postgres/schema/<feature>.schema.ts`,
then:

```bash
bun run db:generate    # creates a new migration from the diff
bun run db:migrate     # applies it
```

Commit the generated SQL.

### 2. Scaffold the feature

```bash
bun run new:resource -- Tickets
```

This generates the four `.ts` files with the right import boundaries
already in place. Edit each to fit the domain.

A minimal **service**:

```ts
import { eq } from "drizzle-orm";
import { db } from "../../clients/postgres";
import { tickets } from "../../clients/postgres/schema";
import { AUDIT_ACTIONS, auditLogService } from "../../lib/audit-log";
import { ApiErrors } from "../../lib/errors";

export class TicketsService {
  async create(userId: string, name: string) {
    const [created] = await db
      .insert(tickets)
      .values({ userId, name })
      .returning();
    if (!created) throw ApiErrors.internal("Failed to create ticket");
    void auditLogService.record({
      userId,
      action: AUDIT_ACTIONS.NOTIFICATION_STATUS_UPDATED,
      metadata: { ticketId: created.id },
    });
    return created;
  }
}

export const ticketsService = new TicketsService();
```

The `audit-log` plugin **requires** a recorded event for every mutating
service method (`create*`, `update*`, `delete*`, ...). The
`db-transactions` plugin requires `db.transaction(async (tx) => …)` if
the function performs ≥2 writes.

A minimal **routes** file:

```ts
import { createAuthMiddleware } from "../auth/auth.plugin";
import { CreateTicketSchema, TicketResponse } from "./tickets.schemas";
import { ticketsService } from "./tickets.service";

export default createAuthMiddleware().post(
  "/",
  ({ body, user }) => ticketsService.create(user.id, body.name),
  {
    body: CreateTicketSchema,
    response: TicketResponse,
    detail: { tags: ["Tickets"], security: [{ cookieAuth: [] }] },
  }
);
```

### 3. Wire it

- `src/config/routes.ts` — import + add to `routes`.
- `src/config/app.ts` — `.group("/api/v1/tickets", ...)`.
- `src/config/swagger.ts` — add the tag.

## Errors

Throw `ApiErrors.*` from services. Routes auto-translate to a typed
response. `throw new Error(...)` produces a generic 500 — the `elysia`
plugin flags it.

```ts
throw ApiErrors.notFound("Ticket");
throw ApiErrors.validation("name is reserved", "name");
```

## Logging

```ts
logger.info("User registered", {
  event: "auth.register.success", // required by structured-logging plugin
  userId: created.id,
  email: maskEmailForLogging(created.email), // PII must be masked
});
```

Never `String(error)` — use `getErrorMessage(error)` (autofixable).

## Tests

- Unit (`tests/lib/**`, `tests/auth/**`) — pure-function tests, always run.
- Integration (`tests/api/**`) — hit Drizzle/Postgres; import
  `requireDb` from `tests/helpers/db.ts` and silently skip when no DB
  is reachable.

```bash
(cd ../../infra/compose/compose && ./dev.sh up)
bun run db:push
bun test
```

`tests/helpers/db.ts` re-exports `db`, `eq`, `and`, `or`, and the schema
tables — integration tests **must** import from there, not from
`drizzle-orm` or `clients/postgres/schema` directly (`test-conventions`
plugin enforces this).

Every test file mirrors a source path:
`tests/api/auth/services/auth.service.test.ts` ↔
`src/api/auth/services/auth.service.ts`.

## The `bun run check` contract

`check` is the source of truth. The lint config is intentionally strict:

- no `any` (use `unknown` + narrow)
- no `as` casting (only `as const`)
- no non-null `!`
- no floating promises, no unsafe enum comparisons
- exhaustive `switch`
- 14 architectural plugins (see [AGENT_CONTRACT.md §ESLint plugins](AGENT_CONTRACT.md#eslint-plugins))

If a rule fights real intent, edit `eslint.config.js`. **Never**
`eslint-disable` inline.
