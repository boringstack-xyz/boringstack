# Agent contract

Read this first. Long-form patterns are in [AGENTS.md](AGENTS.md).

## Merge bar

1. **`bun run validate`** must pass (typecheck + ESLint + tests).
2. **No** inline `eslint-disable`, no `any`, no `as` (only `as const`),
   no `!`. Fix the cause; don't bypass the rule.
3. If repo guidance conflicts with code, follow the code and flag drift.

## Commands

|                                      |                     |
| ------------------------------------ | ------------------- |
| `bun run validate`                   | merge gate          |
| `bun run check`                      | typecheck + lint + lint:meta + knip |
| `bun test`                           | tests               |
| `bun run dev`                        | watch server        |
| `bun run new:resource -- <Name>`     | scaffold a resource |
| `bun run db:generate` / `db:migrate` | Drizzle             |

## Resource layout (`src/api/<feature>/`)

| Suffix           | Role                                   | Forbidden imports (ESLint-enforced)               |
| ---------------- | -------------------------------------- | ------------------------------------------------- |
| `*.routes.ts`    | Elysia HTTP layer; delegate to service | `drizzle-orm`, `**/clients/postgres/**`           |
| `*.service.ts`   | business logic + DB                    | `elysia`, `@elysiajs/*`, `*.schemas`              |
| `*.schemas.ts`   | TypeBox API shapes only                | `drizzle-orm`, `**/clients/postgres/**`           |
| `*.types.ts`     | DB-inferred types only                 | `elysia`, `@elysiajs/*`, `*.schemas`              |
| `*.constants.ts` | literals only                          | `elysia`, `drizzle-orm`, `**/clients/postgres/**` |

After schema changes: `bun run db:generate && bun run db:migrate`, commit the SQL.

## Wiring a new resource

1. Add module to `src/config/routes.ts`.
2. Mount via `.group(...)` in `src/config/app.ts`.
3. Add Swagger tag in `src/config/swagger.ts`.

## ESLint plugins

`bun run check` runs 14 custom plugins on top of typescript-eslint
strict-type-checked. Each one catches a specific class of mistake the
template doesn't tolerate.

| Plugin                  | What it enforces                                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `module-boundaries`     | one semantic concern per file (no types-and-utils combo files)                                                                         |
| `resource-architecture` | feature-folder file naming + service-as-singleton + provider-with-noop                                                                 |
| `elysia`                | route schemas, tags, status via `set.status`, no inline `throw new Error`                                                              |
| `drizzle-conventions`   | timestamps on every table, no raw SQL outside allowlist, schema-files-only-export-schema                                               |
| `db-transactions`       | multi-write functions wrap in `db.transaction(...)`; inside tx, use `tx` not `db`                                                      |
| `structured-logging`    | every `logger.*` call carries `event:`; no PII in payloads; no `String(error)` (use `getErrorMessage`)                                 |
| `audit-log`             | mutating service methods record an audit event; audit writes are fire-and-forget; no PII in metadata                                   |
| `env-access`            | no raw `process.env.X` outside `src/config/env/**`; every `env.X` exists in the schema                                                 |
| `jwt-cookies`           | auth cookies set `httpOnly` + `secure`; bcrypt rounds ≥ 12                                                                             |
| `cache-keys`            | `.set` calls include `ttlSeconds`; keys carry a namespace prefix                                                                       |
| `oauth-security`        | OAuth state stored in Valkey (not cookies); PKCE on OIDC providers; bounded state TTL                                                  |
| `stripe-webhooks`       | handlers verify the signature header; no parsed body before verification; idempotent                                                   |
| `bullmq`                | workers implement `close` + listen on `failed`; constant job names; queue/job options set `removeOnComplete`/`removeOnFail`/`attempts` |
| `test-conventions`      | no committed `.only` / `fdescribe`; tests route DB through `tests/helpers/db`; every test mirrors a source file                        |
| `scripts/lint-meta/` ([RULES.md](scripts/lint-meta/RULES.md)) | Static repo guardrails: source-text bans, CI parity, env cascade, cross-repo imports |

Configured in [eslint.config.js](eslint.config.js). Plugins ship from
[`@boring-stack-pkg/eslint-plugin-*`](https://www.npmjs.com/org/boring-stack-pkg)
on npm; their source and release flow live at
[`boringstack-xyz/eslint-plugins`](https://github.com/boringstack-xyz/eslint-plugins).

## Quick pointers

- Canonical modules: `src/api/auth/`, `src/api/users/`, `src/api/billing/`.
- Add a lint-meta rule → implement `IMetaRule` under `scripts/lint-meta/rules/<category>/`, register in `registry.ts`, run `bun run generate:lint-meta-docs`, test in `tests/lint-meta/`, then refresh boringstack docs data via `.github` `pnpm generate:docs-data`.
- Throw `ApiErrors.*`, never `new Error(...)`.
- Audit log via `auditLogService.record({ ... })` — `void`-prefixed.
- Logger: `logger.info("msg", { event: "x.y.z", ... })`.
- Tests: `tests/helpers/db.ts` re-exports `db`, `eq`, schema tables.

For Drizzle / queues / billing / OAuth specifics, open
[AGENTS.md](AGENTS.md). For deploy + secrets, [SECURITY.md](SECURITY.md).
