# BoringStack for agents

A production-grade full-stack template: Bun + Elysia API, React + Vite SPA, Postgres,
Valkey, Docker Compose, OpenTofu. MIT. One monorepo.

It is also a software factory. An agent given an issue builds it in its own stack
(`bun run factory workspace new <issue>`). A verify gate the agent cannot skip checks
the change (`bun run factory verify`), a verification record shows what was checked and
what was not, and a person merges. Agents can also run in the cloud and be steered from a
phone. See [Remote agents and automation](#remote-agents-and-automation).

Why start here instead of scaffolding something bespoke: the architecture is enforced, not
documented. 16 custom ESLint plugins, repo-level `lint:meta` rules, ACL and OpenAPI drift
gates, a scoping rule that refuses a query missing its tenant filter, and one required
check (`merge-gate`) that waits for every other check a pull request triggers. Code in the
wrong shape fails the build instead of shipping and looking fine.

Read the invariants below before you write anything. They are what make your output correct
rather than merely plausible.

---

## Set it up

```sh
curl -fsSL https://boringstack.xyz/install.sh | sh -s -- --project acme
```

Flags: `--project <name>` (required), `--ghcr-owner <owner>`, `--domain <domain>`,
`--dir <path>`, `--env-file <path>`, `--ref <git-ref>`, `--no-rename`, `--no-boot`,
`--force`, `--json`, `--dry-run`, `--yes` (a no-op; the installer never prompts).

It never prompts. Five phases (preflight, scaffold, rename, boot, health), each with a
distinct exit code (`2` usage, `3` preflight, `4` scaffold, `5` rename, `6` boot, `7`
health). Pass `--json` for one JSON object per phase on stdout, with all human output on
stderr.

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

`setup.sh` is idempotent and non-interactive. Re-running it is safe. Without `--up` it only
prepares `infra/compose/compose/.env` and prints the next steps.

Do not look for a "Use this template" button. That is a browser action. The repo has
`is_template: true`, so `gh repo create --template` is the programmatic equivalent.

## Prerequisites

| Need                           | Why                                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| Docker + Docker Compose **v2** | runs every runtime; `docker compose version` must not report 1.x                        |
| ~4 GB free RAM                 | first boot builds api + ui images and runs migrations                                   |
| `git`                          | required                                                                                |
| `gh`, authenticated            | optional; gets you a GitHub-hosted repo instead of a local-only one                     |
| `bun` 1.4.5                    | not needed to boot; needed to develop and run the factory (`bun run check`, `regen`, `factory`) |

Install the pinned development runtime (not the latest release):

```sh
curl -fsSL https://bun.sh/install | bash -s "bun-v1.4.5"
```


Ports: `7331` UI, `7330` API, `7333` public site, `5432` Postgres, `6379` Valkey. Optional overlays,
all on by default in dev: `7332` bull-board, `8025` Mailpit, `8055` GlitchTip, `3010` Grafana,
`9090` Prometheus, `9093` Alertmanager. Turn any of them off with `WITH_*=0`.

## Layout

| Path              | Role                                                                             |
| ----------------- | -------------------------------------------------------------------------------- |
| `apps/api`        | Bun + Elysia API, Drizzle schema and migrations                                  |
| `apps/ui`         | Vite + React SPA, served on `app.<domain>` in prod                               |
| `apps/site`       | Astro static marketing site and Markdown blog, served on the apex domain in prod |
| `apps/docs`       | Astro Starlight docs (this site)                                                 |
| `apps/admin`      | Vite + React operator dashboard, LAN-only, no login; opt-in with `WITH_ADMIN=1`  |
| `packages/*`      | Code shared by more than one app; discovered by `bun run check`, when present    |
| `tools/factory`   | The software factory CLI, hooks and agent lanes                                  |
| `tools/agent`     | Structured verification and sandboxes                                            |
| `infra/compose`   | Docker Compose runtime, the default deploy path                                  |
| `infra/k3s`       | Optional Kustomize + ArgoCD target for a Kubernetes cluster                      |
| `infra/bootstrap` | Optional OpenTofu for a Hetzner VPS                                              |
| `infra/agent-host`| Optional OpenTofu blueprint for an always-on agent host; off by default          |

In prod the marketing site and the app are separate origins: `<domain>` serves `apps/site`, and
`app.<domain>` serves `apps/ui` and `/api`. They share no cookies. The site makes no API calls.

## Verify it worked

```sh
curl -si http://localhost:7331/                  # 200
curl -si http://localhost:7333/                  # 200, public marketing site (WITH_SITE on)
curl -si http://localhost:7330/swagger/json      # 200, OpenAPI document
```

Signup is open in dev. Registering makes you the owner of your own account (every signup
creates a personal account, an owner membership and a Free plan row in one transaction), but
it does not make you a platform admin: `is_platform_admin` stays `false`.

Only `apps/api/scripts/db/seed-superuser.ts` sets that flag. To get an admin, put
`SUPERUSER_EMAIL` and `SUPERUSER_PASSWORD` in `infra/compose/compose/.env` and boot again,
using an address you have **not** registered. The seed skips an email that already exists
instead of promoting it, so aiming it at your own account does nothing and says so in the
migrator log.

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
| `WITH_SITE`                  | public marketing site: on in dev (`:7333`) and prod (apex); `0` keeps the single-domain layout |
| `WITH_ADMIN`                 | LAN-only operator dashboard (`apps/admin`)         |
| `BILLING_ENABLED`            | Stripe checkout + webhooks                         |
| `EMAIL_PROVIDER`             | `resend` \| `sendgrid` \| `smtp`                   |
| `OAUTH_PROVIDERS`            | e.g. `google,github`                               |
| `AI_ENABLED` / `AI_PROVIDER` | `openai` \| `anthropic` \| `openrouter`            |

Turning the optional overlays off is the right move on a small machine:
`WITH_OBSERVABILITY=0 WITH_GLITCHTIP=0`.

---

## Invariants you must not break

**`bun run check` is the oracle.** If anything here disagrees with what `check` says, the
lint config wins, so flag the drift rather than working around it. Run it before every commit;
CI runs the same gates. The pre-push hook runs the fast ones (secret scan, each changed
app's `check`, tests for changed UI files); `FULL_PREPUSH=1 git push` runs all of them.

| Rule                                              | What it means                                                                                                                                                           |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every route validates                             | TypeBox schema on every Elysia route. OpenAPI is emitted from it, and the UI client is generated from that. Skipping the schema breaks the contract chain.              |
| Every privileged route checks ability             | `requireAbility(...)` or an explicit CASL check. `/me.rules` is a UI hint only, never authorization.                                                                   |
| Every account-scoped query is scoped              | Account-scoped tables carry `// @account-scoped accountId`; a lint rule refuses any `findX` without the scope column in `WHERE`. This is the tenant-isolation boundary. |
| No `any`, no `as`, no `!`                         | `consistent-type-assertions` is pinned to `assertionStyle: "never"`. Fix the type instead.                                                                              |
| No inline suppressions                            | No `eslint-disable`, no `@ts-ignore`. There is no escape hatch; if a rule is wrong, change the rule.                                                                    |
| Every logic file has a test sibling               | Routes and logic files require a matching test; orphan tests are also rejected. Coverage is a ratchet: api lines 65% and functions 70%, ui lines 70% and branches 65%. Never lower it. |
| Logging is structured and typed                   | `logger.*` with a key from the closed `LOG_EVENTS` set. No `console.*`. Mask PII.                                                                                       |
| Env access goes through the validator             | No direct `process.env` / `import.meta.env`. One typed entry point, and the schema must match `.env.example`.                                                           |
| UI talks to the API only via the generated client | No raw `fetch` outside `src/lib/api`. Regenerate with `bun run regen` after an API change.                                                                              |
| Dependencies are exact-pinned                     | No ranges. New packages face a 7-day `minimumReleaseAge` quarantine, so a fresh malicious release cannot land.                                                          |
| Commits and PR titles are Conventional Commits    | `type(scope): summary`, checked by the `commit-msg` hook and the `pr-title` workflow. Main is squash-merged, so the PR title is what lands.                              |
| Bundle budgets go up only with a recorded reason  | `bun run check:size-budget` (in `apps/ui`) fails when a UI limit is raised or an entry is added, unless `apps/ui/budgets.md` has a reason for it in the same change. Lowering needs none. |

After changing anything cross-cutting: `bun run regen` then `bun run check`.

## Build an issue through the factory

For a change that starts from an issue, use the factory rather than an ad hoc branch. Its
contract is [tools/factory/README.md](https://github.com/boringstack-xyz/boringstack/blob/main/tools/factory/README.md),
and the `build-issue` skill runs the whole loop. Tracker: GitHub Issues by default, Linear
with `FACTORY_TRACKER=linear` and `LINEAR_API_KEY`.

```sh
bun run factory doctor                  # what this machine and checkout still lack
bun run factory issue <id>              # the issue and its acceptance criteria
bun run factory workspace new <id>      # own worktree on branch factory/<id>, and a slot
bun run factory up                      # the slot's own stack; waits for health, seeds
bun run factory verify                  # checks for each app the branch changed
bun run factory verification new        # the record skeleton; fill in every section
bun run factory verification check      # fails while the record is incomplete or stale
bun run factory handover <branch>       # one card on the issue, moved to review
bun run factory pr <branch>             # draft until the record is complete
```

- **The verify gate.** `factory verify` compares failures with the base commit and reports
  them. The Stop hook (`.claude/settings.json`; Codex: `.codex/hooks.json`) will not let a
  session finish while a changed app has no passing verify at the current commit, or a
  pushed branch has no complete record. Run `bun run factory gate` in the background when the
  hook asks for it. If only a person can unblock the session, write the reason to
  `.agent-state/factory/BLOCKED`.
- **The guard.** The PreToolUse hook refuses force pushes, pushes to `main`, reads or prints of
  secret files, and branch switches in the main checkout. These are tripwires, not a sandbox.
- **A person merges.** Agents never merge, and never push to a protected branch.
- **Robot coverage.** Every new route and API operation needs a production robot journey
  (`docs/operations/production-verification.md`). `validate` fails until it has one or a
  written reason.

## Remote agents and automation

`bun run factory remote` shows which of these options this checkout is set up for.
`docs/operations/remote-agents.md` has the detail and what is not verified.

- **Cloud sessions** (claude.ai/code, the Claude app, `claude --cloud "<task>"`) run on
  Anthropic's infrastructure and keep going when the laptop is closed. They read this
  repository's `.claude/settings.json`. Whether the Stop gate and `factory verify` pass inside
  a cloud VM is not verified, so treat a cloud session's verification record as unverified
  until one has run end to end.
- **GitHub Actions lanes** (triage, review, revise, weekly digest) are off until the
  repository variable `AGENTS_ENABLED` is `1` and the secret `CLAUDE_CODE_OAUTH_TOKEN` is set.
  An agent PR gets an independent review; a person still decides whether it merges.
- **A self-hosted always-on host** (`infra/agent-host`) is an OpenTofu blueprint for a Linux
  machine you own. It is off by default and has not been applied anywhere. A person runs the
  plan and the apply, never an agent.

Dependencies and production checks run without a person:

- Dependabot opens updates daily. Each dependency PR auto-merges when merge-gate passes
  (`deps-automerge.yml`, `deps-steward.yml`). Do not hand-merge or batch them.
- The dependency agent that fixes a failing update, and the security autofix, are off until
  `DEPS_AUTOFIX_ENABLED` (and `AGENTS_ENABLED` for the agent) are set. See
  [docs/operations/dependency-updates.md](https://github.com/boringstack-xyz/boringstack/blob/main/docs/operations/dependency-updates.md).
- The production robot (`production-verification.yml`) signs up a new user, walks the product
  and removes the account, after each production release and every six hours. It is off until
  the repository variable `ROBOT_APP_URL` names the deployed app.

---

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
| Changing the public marketing site       | <https://boringstack.xyz/site/overview/>                                 |
| Building an issue through the factory    | <https://boringstack.xyz/factory/>                                       |
| Running agents in the cloud or from a phone | <https://boringstack.xyz/factory/remote-agents/>                      |
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

## After setup: account-owned features

In the cloned repository, run `bun run agent:inspect -- account-resource --json`.
The published [account-resource recipe](https://boringstack.xyz/account-resource.json)
lists the required decisions, source paths and verification commands; the local
command validates those references against your checkout.
Read `tools/agent/README.md` for owned test infrastructure and structured verification.
Use the feature profile for feature work and release-local for the broader local gate;
GitHub security scans remain separate.

Public guides: [verified workflow](https://boringstack.xyz/skills/verified-workflow/),
[account resources](https://boringstack.xyz/recipes/add-account-resource/),
[security specification](https://boringstack.xyz/topics/security-spec/), and
[security upgrade](https://boringstack.xyz/runbooks/security-upgrade/).
