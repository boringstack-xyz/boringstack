# BoringStack monorepo

Single repository: `apps/api`, `apps/ui`, `apps/docs`, `apps/site`, `infra/compose`, `infra/bootstrap`.

<!-- template-onboarding:start -->
## Starting a new project from this template

This repo is a GitHub template, so there is a programmatic path. Do not look for
the "Use this template" button; it is a browser action.

```bash
curl -fsSL https://boringstack.xyz/install.sh | sh -s -- --project acme
```

That does preflight, scaffold, rename, boot and a health check, and never
prompts. The equivalent by hand:

```bash
gh repo create acme --template boringstack-xyz/boringstack --private --clone
cd acme && ./scripts/rename-project.sh acme acme-corp acme.com && ./setup.sh --up
```

The one-page version for an agent, including the invariants that keep generated
code passing CI, is served at <https://boringstack.xyz/agents.md>.

<!-- template-onboarding:end -->

## Maintainer commands (repo root)

```bash
bun run regen           # cross-app generators (ACL, OpenAPI, lint-meta, docs JSON)
bun run check           # drift checks before push
bun run rename:project  # one-shot rebrand after Use this template (boringstack → your project)
./setup.sh --up         # boot local dev stack
./scripts/audit-repo-settings.sh # diff GitHub repo settings vs .github/desired-repo-settings.json
```

## Pre-push

The root `pre-push` hook is fast by default: the secret scan, each changed
app's `bun run check`, the UI tests for changed files, shared packages and the
static Compose checks. Full suites, builds, budgets, semgrep, osv-scanner and
the smoke/Playwright runs are the pull request's required checks.
`FULL_PREPUSH=1 git push` runs the whole gate locally.

## Structured verification

Start account-owned feature work with `bun run agent:inspect -- account-resource --json`.
Use `sandbox:up`, then `agent:verify -- --profile=feature --sandbox=<id> --json`,
and `sandbox:down -- --id=<id>`. `release-local` adds security, coverage and builds.
Exit 0 is passed, 1 failed, 2 blocked; never present skipped/unavailable checks as
complete. See [tools/agent/README.md](tools/agent/README.md) for scope and cleanup.
Run `agent:check` and the deterministic `agent:eval --deterministic` for tooling changes.
Tooling and templates obey the same strict script policy as the API; `agent:quality`
checks types, lint and formatting and is also included in root `check`.

## Layout

| Path              | Role                   |
| ----------------- | ---------------------- |
| `apps/api`        | Bun + Elysia API       |
| `apps/ui`         | Vite + React UI        |
| `apps/docs`       | Astro docs site        |
| `apps/site`       | Astro public marketing site (static, nginx) |
| `infra/compose`   | Docker Compose runtime |
| `infra/bootstrap` | OpenTofu bootstrap     |
| `packages/*`      | Shared code used by more than one app ([guide](apps/ui/docs/agents/shared-packages.md)) |
| `.tsforge`        | tsforge scaffold manifest (see below) |

CI: `.github/workflows/` at repo root with path filters.

Self-hosted runners: set the repository variable `CI_RUNNER` to a runner label
and every job moves off GitHub-hosted minutes. Pull requests from forks always
stay on `ubuntu-24.04`, so outside code never runs on your machines, and
`production-release.yml` always runs GitHub-hosted. The lint-meta rule
`github-actions-runner-pinned` rejects a `vars.CI_RUNNER` without that guard.

Remote: https://github.com/boringstack-xyz/boringstack

## Scaffold manifest: keep it in sync

`.tsforge/scaffold-manifest.json` is the single source of truth for this stack's
config surface: every field with its kind and per-`STACK` defaults, the services
each toggle spawns, the secrets each one requires, and the cross-rules between
them.

It is the public agent contract. When present, `apps/docs` publishes it verbatim
as `/scaffold-manifest.json` (via
`bun run generate:scaffold-manifest`, drift-checked in `build:ci`) so any agent
asked to set this stack up can read the real options instead of guessing at env
vars. The tsforge setup wizard is one consumer: it clones BoringStack and reads
this file to drive the questions it asks, the container-topology preview (5 vs 20
services), the required-secrets checklist, and the `.env` it writes. tsforge holds
no stack knowledge of its own; it all lives here.

**When you change the config surface, update this file in the same change.** That
means whenever you:

- add / rename / remove an env **toggle** (`WITH_*`, `*_ENABLED`) or feature flag,
- add a **provider choice** (e.g. a new `EMAIL_PROVIDER`) or its required secret(s),
- change which **services** a toggle spawns, or a cross-dependency between settings,

…edit the matching `fields` / `crossRules` / `alwaysOnServices` entry. Each field
records `key`, `kind` (`toggle`/`one-of`/`multi`/`secret`/`text`), per-`STACK`
defaults, `addsServices`, `requiresSecrets` (and `requiresSecretsWhen` to gate a
secret on an enabling toggle), and `requiresSecretsProdOnly`.

This is enforced: tsforge's scaffold test suite runs a **completeness alarm** that
cross-checks this manifest against the real `.env.example` files and FAILS if a
watched toggle is neither modelled here nor waived via `watchIgnore`. A drifted
manifest is a red build, not a silent gap. The `_about` field at the top of the
JSON restates this for anyone who opens the file directly.

## Commits and pull requests

Every commit subject and PR title is a Conventional Commit:
`<type>(<scope>)!?: <summary>`, at most 100 characters, for example
`fix(api): keep the session after refresh`. This is a gate, not a guideline.
The `commit-msg` hook (installed by `bun install`) and the `pr-title` workflow
both run `scripts/ci/check-commit-title.sh`. Main is squash-merged, so the PR
title is the commit that lands.

These instructions are harness-neutral. Codex, Claude Code and other agents all
start here, and `CLAUDE.md` only points at this file. Put a convention a
product depends on into a hook, a lint rule or CI, and keep this file in sync
with it. Prose that only one harness reads stops being followed when the
harness changes.

## Generated content and data

Large generated artifacts, such as content libraries, catalogue imports and
rendered diagrams, do not belong in the same commit or PR as hand-written
code. Commit the generator and its source data, then regenerate in a separate
`chore(content): ...` change, or build the artifacts in CI. A 500k-line diff
cannot be reviewed, and it hides the code change that travels with it.
