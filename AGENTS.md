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

| Path | Was | Role |
|------|-----|------|
| `apps/api` | api-template | Bun + Elysia API |
| `apps/ui` | ui-template | Vite + React UI |
| `apps/docs` | .github / boringstack.xyz | Astro docs site |
| `infra/compose` | infra-docker-compose-template | Docker Compose |
| `infra/bootstrap` | infra-bootstrap-tofu-template | OpenTofu bootstrap |

CI: `.github/workflows/` at repo root with path filters.

Remote: https://github.com/boringstack-xyz/boringstack
