---
description: Regenerate src/lib/api/schema.d.ts from a running api-template (boots the docker stack if needed)
---

Regenerate `src/lib/api/schema.d.ts` from api-template's current OpenAPI surface.

The full sequence — boot docker → wait for `/swagger/json` → run `generate:api` → verify → commit — is in this command so it can be done in one step instead of pieced together from memory or shell history.

## Step 1 — verify environment

Confirm the agent is operating in the ui-template repo root by checking that `package.json` contains `"name": "ui-template"`. If not, stop and tell the user to `cd` into ui-template first.

## Step 2 — Is api-template already running on :3000?

Probe `http://localhost:3000/swagger/json`:

```bash
curl -fsS http://localhost:3000/swagger/json -o /dev/null
```

If it succeeds, skip Step 3 and go straight to Step 4.

## Step 3 — Boot the dev stack

If api-template is not reachable, boot it via the infra repo. The expected sibling layout is `../../infra/compose/compose/`.

```bash
# From ui-template:
cd ../../infra/compose/compose
./dev.sh up -d postgres valkey api-migrate-dev api-dev
```

Verify the docker daemon is running first (`docker ps`); if it isn't, ask the user to start OrbStack / Docker Desktop and stop. Don't try to start the daemon yourself.

Then wait up to 60 s for `http://localhost:3000/swagger/json` to be reachable. Poll once per second; bail if it doesn't come up.

## Step 4 — Regenerate the schema

```bash
# From ui-template:
OPENAPI_URL=http://localhost:3000/swagger/json pnpm generate:api
```

The script writes to `src/lib/api/schema.d.ts`. See that file's `AGENTS.md` for the contract.

## Step 5 — Verify the diff

```bash
git status --short src/lib/api/schema.d.ts
git diff --stat src/lib/api/schema.d.ts
```

If the file is unchanged, report "schema was already up to date" and stop — no commit needed.

If there's a diff, summarize what changed (number of new lines, what routes appear new/removed if obvious from the diff). Ask the user whether to commit before running `git add`.

## Step 6 — Commit

When the user confirms, commit only the schema file:

```bash
git add src/lib/api/schema.d.ts
git commit -m "Regenerate OpenAPI schema for api-template main"
```

Do NOT push automatically — the pre-push gate runs the full validate suite, and the user may want to bundle the schema regen with other work in the same push.

## Common failure modes

- **Docker daemon not running** → user starts it manually, re-run.
- **api-template port already taken by stale container** → `docker compose down` in `../../infra/compose/compose` then re-run.
- **`pnpm generate:api` fails with esbuild platform mismatch** → host node_modules were created inside the docker container as root. Run `sudo rm -rf node_modules && CI=true pnpm install --frozen-lockfile` in ui-template, then re-run.
