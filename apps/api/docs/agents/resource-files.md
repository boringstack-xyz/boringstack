# Resource file suffixes

Read when adding a new resource folder under `src/api/<name>/` or
splitting a growing file.

The `module-boundaries` plugin enforces one semantic concern per file
— types and constants never share a file, schemas never hold logic.

| File | Purpose |
| --- | --- |
| `*.routes.ts` | Elysia route group; schemas on every route; `set.status` for status codes; no `throw new Error` (use `ApiErrors.*`) |
| `*.service.ts` | Business logic + Drizzle. Throws `ApiErrors.*`. Singleton export. |
| `*.schemas.ts` | TypeBox `t.*` shapes — request / response only |
| `*.types.ts` | DB-inferred types (`InferSelectModel` / `InferInsertModel`) |
| `*.constants.ts` | Literal values; no Elysia / Drizzle imports |
| `*.utils.ts` | Pure helpers |

Scaffolder: `bun run new:resource -- Posts` writes the full set,
appends the Drizzle table to `src/clients/postgres/schema/app.schema.ts`,
adds the relation, and inserts the `AUDIT_ACTIONS.POSTS_CREATED` key.
