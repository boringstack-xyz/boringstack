---
description: Regenerate apps/ui/src/lib/api/schema.d.ts from a running apps/api (boots the docker stack if needed)
---

Regenerate `apps/ui/src/lib/api/schema.d.ts` from the api's current
OpenAPI surface.

The full sequence — boot docker → wait for `/swagger/json` → run
`generate:api` → verify → commit — is in this command so it can be
done in one step instead of pieced together from memory or shell
history.

## Step 1 — verify environment

Confirm the agent is operating from the BoringStack repo root by
checking that `apps/ui/package.json` contains `"name": "boringstack-ui"`
and `apps/api/package.json` contains `"name": "boringstack-api"`.
If not, stop and tell the user to `cd` into the BoringStack repo root
first.

## Step 2 — Is the api already running on :7330?

Probe `http://localhost:7330/swagger/json`:

```bash
curl -fsS http://localhost:7330/swagger/json -o /dev/null
```

If it succeeds, skip Step 3 and go straight to Step 4.

## Step 3 — Boot the dev stack

If the api is not reachable, boot it via the compose dev script:

```bash
# From the repo root:
infra/compose/compose/dev.sh up -d postgres valkey api-migrate-dev api-dev
```

Verify the docker daemon is running first (`docker ps`); if it isn't,
ask the user to start OrbStack / Docker Desktop and stop. Don't try
to start the daemon yourself.

Then wait up to 60 s for `http://localhost:7330/swagger/json` to be
reachable. Poll once per second; bail if it doesn't come up.

## Step 4 — Regenerate the schema

```bash
# From the repo root:
cd apps/ui && OPENAPI_URL=http://localhost:7330/swagger/json bun run generate:api
```

The script writes to `apps/ui/src/lib/api/schema.d.ts`. See that
file's `AGENTS.md` for the contract.

Shortcut: from the repo root, `bun run regen` runs the same codegen
along with ACL types, lint-meta docs, and docs JSON.

## Step 5 — Verify the diff

```bash
git status --short apps/ui/src/lib/api/schema.d.ts
git diff --stat apps/ui/src/lib/api/schema.d.ts
```

If the file is unchanged, report "schema was already up to date" and
stop — no commit needed.

If there's a diff, summarize what changed (number of new lines, what
routes appear new/removed if obvious from the diff). Ask the user
whether to commit before running `git add`.

## Step 6 — Commit

When the user confirms, commit only the schema file:

```bash
git add apps/ui/src/lib/api/schema.d.ts
git commit -m "Regenerate OpenAPI schema for apps/api main"
```

Do NOT push automatically — the pre-push gate runs the full validate
suite, and the user may want to bundle the schema regen with other
work in the same push.

## Common failure modes

- **Docker daemon not running** → user starts it manually, re-run.
- **api port already taken by stale container** → `docker compose down` from `infra/compose/compose/` then re-run.
- **`bun run generate:api` fails with esbuild platform mismatch** → host node_modules were created inside the docker container as root. Run `sudo rm -rf apps/ui/node_modules && CI=true bun install --frozen-lockfile` from the repo root, then re-run.
