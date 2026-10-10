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

`cleanDatabase()` in a `beforeEach` wipes user-data tables. Add each new
table to `CLEANUP_TARGETS` in `tests/helpers/db.ts`, or to `REFERENCE_TABLES`
if it holds seed or catalog data that tests read but never write.
`tests/clients/postgres/schema/index.test.ts` derives every table from the
Drizzle schema and fails when one is in neither list.

DB-backed tests run only when `TEST_DATABASE_URL` is set; without it they
skip, so a green local run without it says nothing about them. CI sets it.

## Running locally

```bash
(cd ../../infra/compose/compose && ./dev.sh up)
bun run db:push
bun test
```
