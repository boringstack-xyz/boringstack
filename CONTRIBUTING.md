# Contributing

BoringStack is a monorepo. Each app has its own contributor guide with the
patterns and lint rules specific to that surface:

- [apps/api/CONTRIBUTING.md](apps/api/CONTRIBUTING.md) — Elysia routes,
  Drizzle schemas, audit log requirements, the `bun run check` contract.
- [apps/ui/CONTRIBUTING.md](apps/ui/CONTRIBUTING.md) — feature folders,
  TanStack Query patterns, i18n, RTL tests.
- [apps/docs/DEPLOY.md](apps/docs/DEPLOY.md) — how the
  [boringstack.xyz](https://boringstack.xyz) docs site is wired up on
  Cloudflare Pages (build settings, custom domain, rollback flow).

This document covers what's true for any change anywhere in the repo.

## Local setup

From a fresh fork:

```sh
./setup.sh --up
```

That copies `.env`, generates the GlitchTip secret, and brings the full
Compose stack up: Postgres, Valkey, api-dev with migrations applied,
ui-dev on `localhost:7331`, OpenAPI client generated. No local Bun or
Postgres needed.

Sign in at `http://localhost:7331` as `demo@example.com / password123`.

## The merge bar

Every PR runs `bun run validate` in each touched app. CI runs the same
script. Local green is CI green.

`validate` chains:

1. typecheck (`tsc --noEmit`)
2. lint (`eslint --max-warnings 0`)
3. unit + integration tests
4. build

Plus the cross-cutting workflows:

- `openapi-drift` — fails the PR if `apps/ui/src/lib/api/schema.d.ts` is
  stale against the live API contract. Regenerate with
  `cd apps/ui && OPENAPI_URL=http://localhost:7330/swagger/json bun run generate:api`.
- `full-stack-smoke` — boots the compose stack and runs the Playwright
  e2e suite against a freshly migrated DB.

## Commits

- Signed commits required on `main`. Set up signing before pushing.
- Squash-merges only. Commit messages on PRs become the squashed commit
  message — write them so they read well in `git log`.
- Conventional prefixes (`feat:`, `fix:`, `refactor:`, `chore:`,
  `docs:`) are honored by the changelog generator.

## Lint rules

The lint config is strict on purpose:

- No `any` (use `unknown` + narrow)
- No `as` casting (only `as const`)
- No non-null `!`
- No floating promises
- No `eslint-disable` inline — if a rule fights real intent, edit
  `eslint.config.js` and explain why in the PR

Architectural plugins enforce import boundaries, audit-log coverage on
mutating service methods, transactional multi-write paths, sibling tests
for every `*.service.ts` / `*.routes.ts` / `*.utils.ts`, and account
scoping on every query that touches an account-scoped table.

## Reporting bugs

Open an issue at
[github.com/boringstack-xyz/boringstack/issues](https://github.com/boringstack-xyz/boringstack/issues).
Security issues go through the [SECURITY.md](SECURITY.md) flow, not the
public tracker.
