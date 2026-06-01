---
name: add-api-resource
description: >-
  Scaffolds a new Elysia API resource (camelCase folder, Drizzle-backed types,
  service, routes) via bun run new:resource. Use when adding a domain module under
  src/api/, when the user asks for a new endpoint folder, or when wiring routes
  after generator output.
---

# Add API resource (Elysia + Drizzle)

## Preferred path

Run from the repository root (after `nvm use` / Bun per project norms):

```bash
bun run new:resource -- <PascalName>
```

Example: `bun run new:resource -- Tickets`

The script creates `src/api/<camelName>/` with `<prefix>.*.ts` files, adds an `app` schema table in `src/clients/postgres/schema/app.schema.ts` when needed, and prints **manual wiring** steps.

## Manual wiring (required after scaffold)

1. **[src/config/routes.ts](src/config/routes.ts)** — import the default route module and add `tickets: ticketsRoutes` (names must match).
2. **[src/config/app.ts](src/config/app.ts)** — mount with `.group("/api/v1/tickets", (group) => group.use(routes.tickets))` (adjust path and key).
3. **[src/config/swagger.ts](src/config/swagger.ts)** — add `{ name: "Tickets", description: "..." }` to `documentation.tags`.

## Database

After schema changes:

```bash
bun run db:generate
bun run db:migrate
```

Commit generated SQL under `drizzle/`. Do not hand-edit migrations already applied to shared environments.

## Finish line

- Implement real handlers (replace stubs if any), align schemas with product requirements.
- Run **`bun run validate`** before claiming done.

## Reference

Contract (read first): [AGENT_CONTRACT.md](mdc:AGENT_CONTRACT.md). Deep examples and narrative: [AGENTS.md](mdc:AGENTS.md). Canonical modules: `src/api/users/`, `src/api/billing/`.
