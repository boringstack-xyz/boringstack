# BoringStack monorepo

Single repository: `apps/api`, `apps/ui`, `apps/docs`, `infra/compose`, `infra/bootstrap`.

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

## Maintainer commands (repo root)

```bash
bun run regen           # cross-app generators (ACL, OpenAPI, lint-meta, docs JSON)
bun run check           # drift checks before push
bun run rename:project  # one-shot rebrand after Use this template (boringstack → your project)
./setup.sh --up         # boot local dev stack
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
| `.tsforge`        | tsforge scaffold manifest (see below) |

CI: `.github/workflows/` at repo root with path filters.

Remote: https://github.com/boringstack-xyz/boringstack

## Scaffold manifest: keep it in sync

`.tsforge/scaffold-manifest.json` is the single source of truth for this stack's
config surface: every field with its kind and per-`STACK` defaults, the services
each toggle spawns, the secrets each one requires, and the cross-rules between
them.

It is the public agent contract. `apps/docs` publishes it verbatim at
<https://boringstack.xyz/scaffold-manifest.json> (via
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
