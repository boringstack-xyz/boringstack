# BoringStack / boringstack-xyz — Roadmap

## Context

One monorepo that composes into a production-ready full-stack SaaS:

- `apps/api/` — Bun · Elysia · Drizzle · Postgres · Valkey · BullMQ
- `apps/ui/` — Vite · React 19 · TanStack Query · shadcn/ui
- `infra/compose/` — single-host VPS compose stack (Postgres · Valkey · Traefik · GlitchTip)
- `infra/bootstrap/` — OpenTofu bootstrap for the host
- `apps/docs/` — Astro documentation (boringstack.xyz)

Docs live at **boringstack.xyz**.

The monorepo works locally, passes `bun run check`, and deploys end-to-end via the Tofu bootstrap. The remaining work moves it from "complete" to **"production in 5 minutes, reusable across many projects, agent-friendly end-to-end."**

**Sequencing rule:** code and DX work first. Infra / deployment / production-pushing work is at the bottom and won't be touched until the code itself is at the "I'd recommend this to a stranger" bar.

**Test coverage floor (enforced):** apps/api and apps/ui run `lint:meta` rules that fail the merge gate when any `*.{service,utils,jobs,check,routes}.ts` (api) or `*.{utils,queries,mutations,hooks,schemas,store,service}.{ts,tsx}` (ui) lacks a colocated test sibling. Wired into each app's validate path. No new logic file can land without a test.

---

## Code & DX work

### B — Docs that actually land

boringstack.xyz becomes an agent-first, scannable, prompt-rich onboarding surface. Humans skim, agents copy-paste.

- Concise rewrite of every page (assume reader spends < 30 seconds).
- New "Prompts" surface: per-feature snippets agents paste verbatim ("add an authenticated endpoint", "add a BullMQ job", "wire an audit event", "add a translated UI string", "add a notification event").
- "Production in 5 minutes" as the headline once A7 has validated.
- Every page answers two agent questions: what does this provide, what should you paste to use it.
- Versioning: docs pinned to template versions.

**Lift from `infrastructure-for-startups`:** Terraform secrets + drift playbook — condense `Provisioner/LEARN.md` + `Provisioner/UPDATES_DRIFTS_CONFLICTS.md` into one page on operating BoringStack in CI.

**Open brainstorm:** prompts as a separate `.claude/` skill bundle vs in-page snippets vs both. Docs framework migration vs in-place rewrite.

**Known:** docs source at `apps/docs/src/content/docs/` (Astro Starlight → Cloudflare Pages via `wrangler`, see `apps/docs/DEPLOY.md`).

---

### C — Multi-project reuse (audit done, design open)

The monorepo can be forked for N products without painful drift, and existing forks can pull upstream improvements.

**Open: update mechanism design.** Three options:

- Template-as-a-fork (clone, customize, periodically merge upstream)
- Cookiecutter / scaffolder (one-time generation, no upstream tie)
- "Library + app shell" split (most value moves into versioned packages)

Naming, branding, env, and code-comment scrubs so a fresh clone doesn't have BoringStack identifiers everywhere.

---

### D — AI-native DX inside the scaffolded apps

Audited; core deferred. See `docs/workstream-d-audit.md` for the full plan: Langfuse placement, AI MCP recommendation, hook surface. The shared-eslint-plugin extraction shipped 2026-05-19 — all 19 plugins now live in `boringstack-xyz/eslint-plugins` and publish to npm as `@boring-stack-pkg/eslint-plugin-*`. Other sub-items get picked up independently when the surrounding work needs them.

---

## Infra & deployment (DO LAST)

Everything below ships only after the code-DX track above is at "I'd recommend this to a stranger" quality. None of it is touched until then.

### Operational backlog (infra-only)

- **Private-GHCR authentication on the box (hard gate for A7).** `bootstrap.sh` runs `docker compose pull` with no `docker login ghcr.io`. Works on public images; the moment a fork goes private, pulls fail with "manifest unknown."
  - Scope: `ghcr_token` sensitive tofu variable; render `/root/.docker/config.json` from a template (base64 basic auth, perms 0600); `bootstrap.sh` writes/refreshes before `compose pull`; WUD mounts the same file. Document PAT minting, rotation, expiry failure mode.
  - Open design question: PAT-in-tfvars vs OIDC-issued tokens via a deploy workflow. PAT is right for a starter; document the OIDC upgrade path.

---

### A7 — Hetzner end-to-end validation milestone

Operator work, not agent execution. Buy the cheapest Hetzner VPS, run `tofu apply`, verify auto-pull + Traefik TLS + WUD notify on a new push.

**Hard gate:** private-GHCR auth must ship first (validation has to run against a private fork; current bootstrap silently fails on private images).

---

### Validation milestones

1. **Cheapest-Hetzner end-to-end test.** Smallest VPS. `tofu apply`. api + ui from GHCR via prod compose. WUD picks up a new push. Traefik + TLS work. Postgres backups run. The "is BoringStack real?" test.
2. **YouTube video.** Recorded only after milestone 1 is flawless end-to-end.

---

### E — BoringStack as a self-hostable product (parked)

Separate product, not a feature of `boringstack-xyz`. Own repo, design cycle, roadmap. Listed only so it isn't forgotten.

**Pre-conditions:** A7 validated, B solid, D far enough along that the scaffolded apps are demonstrably best-in-class, the cheap-Hetzner validation done manually so the UI's automation surface is known.

---

## Cross-cutting principles

- **DX paramount.** If a step requires reading more than one paragraph or running more than one command, rewrite it.
- **AI-first.** Every artifact (code, doc page, error message) is a prompt. Optimize for paste-ability.
- **Production in 5 minutes.** Constraint, not aspiration. If something breaks it, fix the something.
- **Frictionless after scaffold.** Once cloned and deployed, building the product feature should feel like nothing.

---

## Recommended sequence

**Code-DX track (in order):**

1. **B — Docs that actually land.** Per-feature paste-ready prompts, agent-first rewrite.
2. **C — Multi-project reuse design.** Pick the update mechanism.

**Infra track (only after the code-DX track):**

3. **Operational backlog (infra).** Private-GHCR auth.
4. **A7 — Hetzner end-to-end validation.**
5. **YouTube video.** Once A7 is flawless.
6. **E unparked.** Separate product cycle.

---

## Completed (record only, not pending)

- **Security pipeline** — gitleaks + osv-scanner + semgrep + bun audit on PR + weekly cron; repo settings hardened with signed commits, linear history, secret-scanning push protection. See `boringstack.xyz/topics/security/`.
- **Welcome state** — `DashboardWelcome` + theme tokens, no `dark:` classes.
- **Docker digest pinning** — all `FROM` lines + all third-party compose `image:` refs pinned by `@sha256:`. `scripts/pin-image-digests.sh` refreshes them.
- **F — Agent-discoverable skills** — `/security-review`, `/build-feature`, `/add-audit-event`, `/add-email-template`, `/add-notification-event`, `/add-full-feature` shipped to `.claude/skills/` in apps/api and apps/ui. The broader `/add-database-resource`, `/add-job`, `/add-ui-feature` intents are subsumed by `/build-feature`.
