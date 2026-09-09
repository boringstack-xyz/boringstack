# Claude Code: BoringStack monorepo

Read **[AGENTS.md](AGENTS.md)** first: the setup command, the layout, and the
scaffold-manifest contract. Then open the app you are working in,
**[apps/api/AGENTS.md](apps/api/AGENTS.md)** or
**[apps/ui/AGENTS.md](apps/ui/AGENTS.md)**, each a one-table index pointing at
single-concern guides under `apps/*/docs/agents/`. Load the row your task
matches, not the whole tree.

Setting this up for someone rather than working on it? Everything you need is
on one page at <https://boringstack.xyz/agents.md>.

`bun run check` is the drift gate at the root; each app has its own
`bun run validate`. If the docs and the lint config disagree, the lint config
wins, so flag the drift.
