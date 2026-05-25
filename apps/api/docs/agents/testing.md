# Testing

Read this when writing or running tests.

## Two layers

Both run by `bun test`:

- **Unit tests** (`tests/lib/**`, `tests/auth/**`) — pure-function,
  always run.
- **Integration tests** (`tests/api/**`) — hit Drizzle/Postgres; import
  `requireDb` from `tests/helpers/db`; silently skip when no DB.

## Helpers + lint contract

`tests/helpers/db.ts` re-exports `db`, `eq`, `and`, `or`, and the
schema tables. `test-conventions/no-direct-db-in-tests` blocks
imports from `drizzle-orm` / `clients/postgres/schema` in tests —
go through the helpers entrypoint.

`test-conventions/test-file-mirrors-source` requires every test file
to map 1:1 to a source file (catches orphan tests after refactors).

## Cleanup

`cleanDatabase()` in a `beforeEach` wipes user-data tables. Add new
tables to `TRUNCATE_TARGETS` when you create them.

## Running locally

```bash
(cd ../../infra/compose/compose && ./dev.sh up)
bun run db:push
bun test
```
