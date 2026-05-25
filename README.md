# BoringStack

Production-ready full-stack starter: Bun + Elysia API, Vite + React UI, Astro docs, Docker Compose infra, and optional OpenTofu bootstrap — in one monorepo.

## Layout

```
apps/
  api/     Bun + Elysia + Drizzle API
  ui/      Vite + React SPA
  docs/    boringstack.xyz (Astro Starlight)
infra/
  compose/ Docker Compose runtime
  bootstrap/ OpenTofu VPS bootstrap (optional)
```

## Quick start

```bash
git clone https://github.com/boringstack-xyz/boringstack.git
cd boringstack
./setup.sh --up
open http://localhost:3001
```

Sign in with `SUPERUSER_EMAIL` / `SUPERUSER_PASSWORD` from `infra/compose/compose/.env`, or register a new account.

## Maintainer commands (repo root)

```bash
bun run regen    # ACL → OpenAPI → lint-meta RULES → docs JSON catalogs
bun run check    # all cross-app drift checks (needs api on :3000 for OpenAPI)
bun run check:full   # check + api/ui validate + docs build:ci
```

Docs site: [boringstack.xyz](https://boringstack.xyz) — built from `apps/docs`.
