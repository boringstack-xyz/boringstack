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

---

Done — summary of what shipped

13 audit items landed. 32 files modified, 6 new files, ~570 lines net added. bun run check (api) clean, 877 tests pass, tofu validate clean, all compose overlay combinations validate, docs catalogs in sync.

Code fixes (apps/api)

- Widgets audit actions (widgets.service.ts, audit-log.constants.ts) — WIDGET_CREATED/UPDATED/DELETED replace the copy-pasted USER_PROFILE_UPDATED.
- auth.welcome notification event (events/auth-welcome.event.ts, events/index.ts, email-verification.service.ts, oauth.service.ts) — fires from both verify-email and first-time OAuth registration. Forks have a working example.
- /\_\_test/force-verify typed response (auth.routes.ts) — t.Union([AuthResponse, error-shape]) matches every other route's convention.
- Dashboard activity labels (dashboard.utils.ts + tests) — ACTIVITY_LABELS map translates auth.login_success → "Signed in" before the UI sees it; derives a readable label for unmapped events.
- EMAIL_FROM placeholder guard (config/env/validate.ts + tests) — production refuses to boot with \*@example.com/example.org/example.net/localhost sender domains; 3 new tests pin the behaviour.
- canDisconnect pure helper (lib/oauth/oauth.utils.ts) — extracted from disconnectProvider; 8 new tests cover every locked-out / allowed branch; service is now thin.
- Valkey-backed rate limiter (lib/rate-limit/valkey-context.ts, config/security/security.ts) — elysia-rate-limit uses a Valkey-shared counter when CACHE_ENABLED=true && CACHE_PROVIDER=valkey; in-memory default unchanged. Permissive fallback on Valkey failure (Traefik's edge limit is still in front).

Infra hardening

- Private-GHCR auth (infra/bootstrap/) — ghcr*username + ghcr_token tfvars, rendered into /root/.docker/config.json via cloud-init and into WUD_GHCR*\* in compose/.env. tofu apply is the rotation tool. Closes the A7 hard gate from ROADMAP.
- WUD default → notify-only (docker-compose.wud.yml, .env.example, runbook) — WUD_TRIGGER_DOCKER_APP_AUTO defaults to false. Auto-mode now opt-in with a documented prerequisite checklist.
- Prometheus alert rules (prometheus/rules.yml, mounted via observability overlay) — 13 alerts across api (5xx rate, p95 latency, unreachable), database (down, conn pool, replication), host (disk, memory, CPU), edge (Traefik). Alertmanager wiring untouched (operator adds receivers).
- Backup restore script + runbook (scripts/restore-from-backup.example.sh, updated docs/backup-offsite.md) — partner to backup-wrapper.example.sh; restores into a side-car DB, prints the manual promotion commands. Dry-run via RESTORE_DRY_RUN=1.
- k6 load-test harness (apps/api/scripts/loadtest/) — golden-path scenario: register → force-verify → login → dashboard summary → widget CRUD → SSE. p95 thresholds enforce the budget. bun run loadtest.

DX

- bun run rename:project <project> <ghcr-owner> <domain> (root scripts/rename-project.sh) — atomic rebrand across 24 files. DRY_RUN=1 previews. Tested with acme acme-corp acme.com. Final output prints next steps + the handful of things to rename manually (LICENSE attribution, Sentry DSNs, docs prose).

What's still outstanding from the audit

Architectural decisions still on you:

- #2 Multi-project reuse mechanism — needs a commit to "template-as-fork + bun run upstream-merge runbook" vs scaffolder vs library-split.
- #4, #5, #24 OAuth/Stripe/email runbooks — content writing, no good way to ghostwrite without your voice.
- #7 First-feature-in-10-minutes tutorial — same.
- #8 MFA / TOTP — meaningful feature work (~2 days).
- #16, #17 Cookie consent + privacy/ToS — legal-adjacent, needs your call on tone + jurisdiction defaults.
- #18 Account ownership transfer two-step — design needed for the accept flow.
- #19 Account join requests — decide implement vs delete the schema. Half-feature today.
- #20 LinkedIn OAuth disconnect in UI — UI work outside this api-only pass.
- #28, #29, #30 — landing-page advertising for skills, argon2id decision, JWT revocation list — all judgment calls.

One follow-up needed before pushing

apps/ui/src/lib/api/schema.d.ts will need regeneration once api-dev is running against the new code (the \_\_test/force-verify response shape changed):

cd infra/compose/compose && ./dev.sh up -d postgres valkey api-migrate-dev api-dev
cd apps/ui && OPENAPI_URL=http://localhost:3000/swagger/json bun run generate:api

Then bun run check from the repo root passes clean across api/ui/docs.
