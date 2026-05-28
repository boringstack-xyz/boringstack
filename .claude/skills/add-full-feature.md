---
name: add-full-feature
description: Use when adding a full-stack vertical slice — a new resource that needs an api endpoint AND a ui page consuming it. Orchestrates api `/build-feature` → regenerate the openapi-typed client → ui `/build-feature` for the consumer. Triggers — "add a full feature", "build [X] end to end", "new feature, api + ui", "add a CRUD for [X] with a UI", "full vertical slice for [X]", "wire [X] from db to screen".
---

# Add full feature (cross-app)

You are building a vertical slice that touches both `apps/api` and
`apps/ui` inside this monorepo. This skill is the coordinator — it
dispatches the two app-local `/build-feature` skills in order, with
the OpenAPI-types regen as the bridge.

The skill assumes the standard BoringStack layout: `apps/api`,
`apps/ui`, `apps/docs`, and `infra/compose/compose` under one git
root. Run every command from the repo root unless a step explicitly
`cd`s into an app.

## Checkpoint 1 — Spec the slice

If `.specs/next.md` exists at the repo root and its `status` is
`approved`, read **Problem**, **Slice**, **Design decisions**, and
**Verification contract**, then treat the spec as the answers to the
four questions below — do not re-interview the user.

Otherwise, ask, in this order:

1. **Resource name.** Singular noun, PascalCase. (`Post`, `Project`, `Invoice`.)
2. **api shape.** Fields, types, account-scoping required? Any non-CRUD endpoints?
3. **ui shape.** List page only, or list + detail + create form?
4. **i18n scope.** Add to both `en` and `de` locales (always — non-negotiable per pre-1.0 rules).

Print a one-line summary. Stop until the user confirms.

## Checkpoint 2 — api half

```bash
cd apps/api
```

Dispatch `/build-feature` with:

- Feature kind: **DB-backed resource (table + CRUD routes)**
- Success criteria: the routes from Checkpoint 1
- Notes: enforce `requireAbility` + account-scoping per `apps/api/AGENT_CONTRACT.md`

Let `/build-feature` run its six checkpoints. The gate is
`bun run validate` from `apps/api/` — do not proceed to Checkpoint 3
until it's green.

## Checkpoint 3 — Regenerate the typed client

From the repo root:

```bash
bun run regen
git status -s apps/ui/src/lib/api/
```

`bun run regen` invokes the apps/ui codegen against a running
`apps/api` (port `7330`) — boot the dev stack first if it isn't up:

```bash
infra/compose/compose/dev.sh up -d api-dev
```

If only the UI types need to refresh, the lower-level command is:

```bash
cd apps/ui && bun run generate:api
```

Confirm the new resource shows up in `apps/ui/src/lib/api/schema.d.ts`.
If the diff is empty, the api wasn't running or the spec wasn't
regenerated — STOP and surface this.

CI runs `bun run generate:api:check` (the dry-run variant). Drift
there means a developer skipped the regen — same fix as above.

## Checkpoint 4 — ui half

```bash
cd apps/ui
```

Dispatch `/build-feature` with:

- Feature kind: **New page (route + feature folder)** (or **Wiring an existing API endpoint into the UI** if no new page is needed)
- Success criteria: from Checkpoint 1's ui shape
- Notes: this feature already has typed bindings — `apiClient.GET("/api/v1/<resource>")` should typecheck immediately

Encode "list renders the records the api would have returned" in the
tests-first checkpoint. Mock the OpenAPI client at the call site
(e.g. `vi.mock("@/lib/api/client")` returning typed payloads from
`*.queries.ts` test setup).

Run `bun run validate` from `apps/ui/` as the gate.

## Checkpoint 5 — Cross-cutting verify

Both halves pass their gates. Now a real end-to-end against the smoke
stack:

```bash
STACK=smoke infra/compose/compose/dev.sh up -d --build
```

Open `http://localhost:7331/`, sign in (use the test fixtures in
`apps/ui/e2e/fixtures/` or the `__test/force-verify` endpoint), and
navigate to the new feature route. Confirm:

- The list renders without errors.
- A create form (if added) posts and the new row appears.
- Cross-account scoping holds: switch accounts; the new resource is empty.

## Checkpoint 6 — Diff summary

```bash
git status -s
git diff --stat $(git merge-base HEAD origin/main)..HEAD -- apps/api apps/ui
```

End with:

- ✓ "Full feature `<Name>` shipped. api +N files / +M tests; ui +P files / +Q tests. Ready to commit."
- ✗ "<step> failed; needs human attention before commit."

For any feature touching auth, billing, or multi-tenant data, mention
`/security-review` in both apps as an optional pre-commit pass.

Do NOT run `git commit`, `git push`, or `gh pr create`. The user owns
the commit boundary.
