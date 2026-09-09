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
  <strong>Point your agent at this stack.</strong><br />
  It ships production-grade, or it doesn't compile.
</p>

<p align="center">
  <a href="https://github.com/boringstack-xyz/boringstack/tree/main/apps/api"><img src="https://img.shields.io/badge/apps--api-4ade80?style=for-the-badge&labelColor=090909" alt="apps/api"></a>
  <a href="https://github.com/boringstack-xyz/boringstack/tree/main/apps/ui"><img src="https://img.shields.io/badge/apps--ui-4ade80?style=for-the-badge&labelColor=090909" alt="apps/ui"></a>
  <a href="https://github.com/boringstack-xyz/boringstack/tree/main/infra/compose"><img src="https://img.shields.io/badge/infra--compose-4ade80?style=for-the-badge&labelColor=090909" alt="infra/compose"></a>
  <a href="https://github.com/boringstack-xyz/boringstack/tree/main/infra/bootstrap"><img src="https://img.shields.io/badge/infra--bootstrap-4ade80?style=for-the-badge&labelColor=090909" alt="infra/bootstrap"></a>
  <a href="https://github.com/boringstack-xyz/eslint-plugins"><img src="https://img.shields.io/badge/eslint--plugins-4ade80?style=for-the-badge&labelColor=090909" alt="eslint-plugins"></a>
</p>

## Set it up

```sh
curl -fsSL https://boringstack.xyz/install.sh | sh -s -- --project acme
```

Preflight, scaffold, rename, boot, health check. It never prompts, and `--json`
puts one object per phase on stdout. Pass `--dry-run` first to see the plan.

Or run the steps yourself:

```sh
gh repo create acme --template boringstack-xyz/boringstack --private --clone
cd acme
./scripts/rename-project.sh acme acme-corp acme.com
./setup.sh --up
```

Docker and Compose v2 are the only prerequisites; Compose runs every runtime.
Bun is needed to develop, not to boot.

## If you are an agent

Read [boringstack.xyz/agents.md](https://boringstack.xyz/agents.md). One page:
the setup command, the health checks, the machine-readable config manifest at
[/scaffold-manifest.json](https://boringstack.xyz/scaffold-manifest.json), and
the invariants that make your output pass CI instead of merely look right.

Inside this repo, start at [`AGENTS.md`](AGENTS.md), then
[`apps/api/AGENTS.md`](apps/api/AGENTS.md) or
[`apps/ui/AGENTS.md`](apps/ui/AGENTS.md). Each is a one-table index pointing at
single-concern guides under `apps/*/docs/agents/`. Load the row your task
matches, not the whole tree.

`bun run check` is the oracle. If the docs and the lint config disagree, the
lint config wins.

## Docs

Full documentation is at [boringstack.xyz](https://boringstack.xyz), starting
with the [Quickstart](https://boringstack.xyz/quickstart/) and
[Why BoringStack](https://boringstack.xyz/architecture/why-boringstack/).

## License

MIT
