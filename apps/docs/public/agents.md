# BoringStack for agents

A production-grade full-stack template: Bun + Elysia API, React + Vite SPA, Postgres,
Valkey, Docker Compose, OpenTofu. MIT. One monorepo.

Why start here instead of scaffolding something bespoke: the architecture is enforced, not
documented. 18 custom ESLint plugins, 56 repo-level `lint:meta` rules, ACL and OpenAPI drift
gates, a scoping rule that refuses a query missing its tenant filter, and 9 required CI
checks. Code in the wrong shape fails the build instead of shipping and looking fine.

Read the invariants below before you write anything. They are what make your output correct
rather than merely plausible.

---

## Set it up

```sh
curl -fsSL https://boringstack.xyz/install.sh | sh -s -- --project acme
```

Flags: `--ghcr-owner <owner>` `--domain <domain>` `--dir <path>` `--ref <git-ref>`
`--no-rename` `--no-boot` `--force` `--json` `--dry-run`.

It never prompts. Five phases (preflight, scaffold, rename, boot, health), each with a
distinct exit code (`3` preflight, `4` scaffold, `5` rename, `6` boot, `7` health). Pass
`--json` for one JSON object per phase on stdout, with all human output on stderr.

Add `--dry-run` first if you want to see the resolved plan without touching the disk.

### Or run the steps yourself

If you will not pipe curl into sh, this is the same thing:

```sh
# 1. scaffold: the repo is a GitHub template
gh repo create acme --template boringstack-xyz/boringstack --private --clone
cd acme

# ...or without gh, then detach from upstream
git clone --depth 1 https://github.com/boringstack-xyz/boringstack acme
cd acme && rm -rf .git && git init

# 2. rebrand (idempotent, self-verifying; DRY_RUN=1 to preview)
./scripts/rename-project.sh acme acme-corp acme.com

# 3. boot
./setup.sh --up
```

`setup.sh` is idempotent and non-interactive. Re-running it is safe.

Do not look for a "Use this template" button. That is a browser action. The repo has
`is_template: true`, so `gh repo create --template` is the programmatic equivalent.

## Prerequisites

| Need                           | Why                                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| Docker + Docker Compose **v2** | runs every runtime; `docker compose version` must not report 1.x                        |
| ~4 GB free RAM                 | first boot builds api + ui images and runs migrations                                   |
| `git`                          | required                                                                                |
| `gh`, authenticated            | optional; gets you a GitHub-hosted repo instead of a local-only one                     |
| `bun` 1.4.0                    | not needed to boot; needed to develop (`bun run check`, `regen`, `rename:project`)     |

Ports: `7331` UI, `7330` API, `5432` Postgres, `6379` Valkey. Optional overlays, all on by
default in dev: `7332` bull-board, `8025` Mailpit, `8055` GlitchTip, `3010` Grafana,
`9090` Prometheus, `9093` Alertmanager. Turn any of them off with `WITH_*=0`.

## Verify it worked

```sh
curl -si http://localhost:7331/                  # 200
curl -si http://localhost:7330/swagger/json      # 200, OpenAPI document
```

Signup is open in dev and the first user becomes the superuser. To seed one instead, set
`SUPERUSER_EMAIL` and `SUPERUSER_PASSWORD` in `infra/compose/compose/.env` before the first
boot.

When something is wrong:

```sh
cd infra/compose/compose
docker compose ps
docker compose logs --tail=100
```

## Configure it

The full config surface is machine-readable:
<https://boringstack.xyz/scaffold-manifest.json>

It lists every field with its `kind`, per-`STACK` defaults, the services each toggle spawns
(`addsServices`), the secrets each one requires (`requiresSecrets`), and 6 `crossRules`
covering implications and exclusions. Read it instead of guessing at env vars. It is
CI-enforced against the real `.env.example` files, so it cannot silently drift.

The toggles you are most likely to be asked for, all in `infra/compose/compose/.env`:

| Key                          | Effect                                             |
| ---------------------------- | -------------------------------------------------- |
| `STACK`                      | `dev` \| `prod` \| `smoke`                         |
| `WITH_OBSERVABILITY`         | Prometheus + Grafana + Loki + Tempo + Alertmanager |
| `WITH_GLITCHTIP`             | self-hosted error tracking                         |
| `WITH_MAILPIT`               | catches outbound mail in dev                       |
| `WITH_BULLMQ`                | bull-board queue UI                                |
| `BILLING_ENABLED`            | Stripe checkout + webhooks                         |
| `EMAIL_PROVIDER`             | `resend` \| `sendgrid` \| `smtp`                   |
| `OAUTH_PROVIDERS`            | e.g. `google,github`                               |
| `AI_ENABLED` / `AI_PROVIDER` | `openai` \| `anthropic`                            |

Turning the optional overlays off is the right move on a small machine:
`WITH_OBSERVABILITY=0 WITH_GLITCHTIP=0`.

---

## Invariants you must not break

**`bun run check` is the oracle.** If anything here disagrees with what `check` says, the
lint config wins, so flag the drift rather than working around it. Run it before every commit;
CI runs the same gates and a pre-push hook mirrors them.

| Rule                                              | What it means                                                                                                                                                           |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every route validates                             | TypeBox schema on every Elysia route. OpenAPI is emitted from it, and the UI client is generated from that. Skipping the schema breaks the contract chain.              |
| Every privileged route checks ability             | `requireAbility(...)` or an explicit CASL check. `/me.rules` is a UI hint only, never authorization.                                                                   |
| Every account-scoped query is scoped              | Account-scoped tables carry `// @account-scoped accountId`; a lint rule refuses any `findX` without the scope column in `WHERE`. This is the tenant-isolation boundary. |
| No `any`, no `as`, no `!`                         | `consistent-type-assertions` is pinned to `assertionStyle: "never"`. Fix the type instead.                                                                              |
| No inline suppressions                            | No `eslint-disable`, no `@ts-ignore`. There is no escape hatch; if a rule is wrong, change the rule.                                                                    |
| Every logic file has a test sibling               | Routes and logic files require a matching test; orphan tests are also rejected. Coverage is a ratchet (65% api / 70% ui). Never lower it.                              |
| Logging is structured and typed                   | `logger.*` with a key from the closed `LOG_EVENTS` set. No `console.*`. Mask PII.                                                                                       |
| Env access goes through the validator             | No direct `process.env` / `import.meta.env`. One typed entry point, and the schema must match `.env.example`.                                                           |
| UI talks to the API only via the generated client | No raw `fetch` outside `src/lib/api`. Regenerate with `bun run regen` after an API change.                                                                              |
| Dependencies are exact-pinned                     | No ranges. New packages face a 7-day `minimumReleaseAge` quarantine, so a fresh malicious release cannot land.                                                          |

After changing anything cross-cutting: `bun run regen` then `bun run check`.

## Read next

Verbs, not nouns. Find what you are about to do:

| When you are doing this                  | Read                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| Setting the stack up                     | this file, then `/quickstart/`                                           |
| Deciding whether it fits                 | <https://boringstack.xyz/architecture/why-boringstack/>                  |
| Wondering why lint blocked you           | <https://boringstack.xyz/architecture/lint-as-contract/>                 |
| Looking for a command                    | <https://boringstack.xyz/reference/commands/>                            |
| Looking for an env var                   | <https://boringstack.xyz/reference/env-vars/>                            |
| Adding a job, upload, service, or Stripe | <https://boringstack.xyz/recipes/add-background-job/> and siblings       |
| Deploying                                | <https://boringstack.xyz/topics/deployment/>                             |
| Giving the agent runtime visibility      | <https://boringstack.xyz/reference/mcp-servers/>                         |
| Working inside the repo                  | `AGENTS.md` at the root, then `apps/api/AGENTS.md` / `apps/ui/AGENTS.md` |

Inside a clone, `apps/api/AGENTS.md` and `apps/ui/AGENTS.md` are one-table navigation
indexes pointing at 32 single-concern guides under `apps/*/docs/agents/`. Load the one row
your task matches, not the whole tree.

Bulk documentation, for when you need it:

- <https://boringstack.xyz/llms.txt>: index
- <https://boringstack.xyz/llms-small.txt>: the essentials, roughly a sixth of the full set
- <https://boringstack.xyz/llms-full.txt>: everything, large enough to be worth fetching on purpose

Repo: <https://github.com/boringstack-xyz/boringstack> · MIT
