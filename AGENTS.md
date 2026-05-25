# BoringStack monorepo

Single repository: `apps/api`, `apps/ui`, `apps/docs`, `infra/compose`, `infra/bootstrap`.

## Maintainer commands (repo root)

```bash
bun run regen   # cross-app generators (ACL, OpenAPI, lint-meta, docs JSON)
bun run check   # drift checks before push
./setup.sh --up # boot local dev stack
./scripts/audit-repo-settings.sh # diff GitHub repo settings vs .github/desired-repo-settings.json
```

## Layout

| Path              | Role                   |
| ----------------- | ---------------------- |
| `apps/api`        | Bun + Elysia API       |
| `apps/ui`         | Vite + React UI        |
| `apps/docs`       | Astro docs site        |
| `infra/compose`   | Docker Compose runtime |
| `infra/bootstrap` | OpenTofu bootstrap     |

CI: `.github/workflows/` at repo root with path filters.

Remote: https://github.com/boringstack-xyz/boringstack
