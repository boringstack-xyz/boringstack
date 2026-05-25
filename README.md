<p align="center">
  <a href="https://boringstack.xyz">
    <img src="apps/docs/profile/assets/boringstack-xyz.png" alt="BoringStack" />
  </a>
</p>

<p align="center">
  <a href="https://boringstack.xyz"><img src="https://img.shields.io/badge/boringstack.xyz-4ade80?style=for-the-badge&logo=safari&logoColor=4ade80&labelColor=090909" alt="boringstack.xyz"></a>
  <a href="https://github.com/boringstack-xyz/boringstack"><img src="https://img.shields.io/badge/GitHub-4ade80?style=for-the-badge&logo=github&logoColor=4ade80&labelColor=090909" alt="GitHub"></a>
  <a href="https://boringstack.xyz/quickstart/"><img src="https://img.shields.io/badge/Quickstart-4ade80?style=for-the-badge&logo=readthedocs&logoColor=4ade80&labelColor=090909" alt="Quickstart"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-e8e8ed?style=for-the-badge&labelColor=090909" alt="MIT">
  <img src="https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=fbf0df&labelColor=090909" alt="Bun">
  <img src="https://img.shields.io/badge/React-20232a?style=for-the-badge&logo=react&logoColor=61dafb&labelColor=090909" alt="React">
  <img src="https://img.shields.io/badge/Elysia-4ade80?style=for-the-badge&labelColor=090909" alt="Elysia">
  <img src="https://img.shields.io/badge/TypeScript-3178c6?style=for-the-badge&logo=typescript&logoColor=3178c6&labelColor=090909" alt="TypeScript">
  <img src="https://img.shields.io/badge/Docker-2496ed?style=for-the-badge&logo=docker&logoColor=2496ed&labelColor=090909" alt="Docker">
  <img src="https://img.shields.io/badge/PostgreSQL-4169e1?style=for-the-badge&logo=postgresql&logoColor=4169e1&labelColor=090909" alt="PostgreSQL">
</p>

<p align="center">
  <strong>Production-ready from the first fork.</strong><br />
  One monorepo for the full stack. Clone, boot with <code>./setup.sh --up</code>, deploy on Compose.
</p>

<p align="center">
  <a href="https://github.com/boringstack-xyz/boringstack/tree/main/apps/api"><img src="https://img.shields.io/badge/apps--api-4ade80?style=for-the-badge&labelColor=090909" alt="apps/api"></a>
  <a href="https://github.com/boringstack-xyz/boringstack/tree/main/apps/ui"><img src="https://img.shields.io/badge/apps--ui-4ade80?style=for-the-badge&labelColor=090909" alt="apps/ui"></a>
  <a href="https://github.com/boringstack-xyz/boringstack/tree/main/infra/compose"><img src="https://img.shields.io/badge/infra--compose-4ade80?style=for-the-badge&labelColor=090909" alt="infra/compose"></a>
  <a href="https://github.com/boringstack-xyz/boringstack/tree/main/infra/bootstrap"><img src="https://img.shields.io/badge/infra--bootstrap-4ade80?style=for-the-badge&labelColor=090909" alt="infra/bootstrap"></a>
  <a href="https://github.com/boringstack-xyz/eslint-plugins"><img src="https://img.shields.io/badge/eslint--plugins-4ade80?style=for-the-badge&labelColor=090909" alt="eslint-plugins"></a>
</p>

## Quick start

```bash
git clone https://github.com/boringstack-xyz/boringstack.git
cd boringstack
./setup.sh --up
open http://localhost:3001
```

Sign in with `SUPERUSER_EMAIL` / `SUPERUSER_PASSWORD` from `infra/compose/compose/.env`, or register a new account.

Docs: [boringstack.xyz/quickstart](https://boringstack.xyz/quickstart/)

## Layout

```
apps/
  api/          Bun + Elysia + Drizzle API
  ui/           Vite + React SPA
  docs/         boringstack.xyz (Astro Starlight)
infra/
  compose/      Docker Compose runtime
  bootstrap/    OpenTofu VPS bootstrap (optional)
```

| Path | Was | Role |
|------|-----|------|
| `apps/api` | api-template | Bun + Elysia API |
| `apps/ui` | ui-template | Vite + React UI |
| `apps/docs` | .github / boringstack.xyz | Astro docs site |
| `infra/compose` | infra-docker-compose-template | Docker Compose |
| `infra/bootstrap` | infra-bootstrap-tofu-template | OpenTofu bootstrap |

## Maintainer commands (repo root)

```bash
bun run regen    # ACL → OpenAPI → lint-meta RULES → docs JSON catalogs
bun run check    # all cross-app drift checks (needs api on :3000 for OpenAPI)
bun run check:full   # check + api/ui validate + docs build:ci
./scripts/audit-repo-settings.sh   # diff GitHub repo settings vs desired config
```

## License

MIT
