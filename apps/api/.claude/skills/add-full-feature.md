---
name: add-full-feature
description: Use when adding a full-stack vertical slice — a new resource that needs an api endpoint AND a ui page consuming it. Orchestrates api `/build-feature` → regenerate the openapi-typed client → ui `/build-feature` for the consumer. Triggers — "add a full feature", "build [X] end to end", "new feature, api + ui", "add a CRUD for [X] with a UI", "full vertical slice for [X]", "wire [X] from db to screen".
---

# Add full feature (cross-repo)

You are building a vertical slice that touches both `api-template` and `ui-template`. This skill is a coordinator — it dispatches the two repo-local skills in the right order, with the OpenAPI-types regen as the bridge.

The two repos live as **sibling directories** under the same workspace root (e.g. `~/code/my-project/api-template/` and `~/code/my-proje../ui/`). The skill assumes that layout.

## Checkpoint 1 — Spec the slice

Ask the user, in this order:

1. **Resource name.** Singular noun, PascalCase. (`Post`, `Project`, `Invoice`.)
2. **api shape.** Fields, types, account-scoping required? Any non-CRUD endpoints?
3. **ui shape.** List page only, or list + detail + create form?
4. **i18n scope.** Add to both `en` and `de` locales (always — non-negotiable per pre-1.0 rules).

Print a one-line summary. Stop until the user confirms.

## Checkpoint 2 — api half (in `api-template/`)

```bash
cd ../api-template
```

Dispatch `/build-feature` with:

- Feature kind: **DB-backed resource (table + CRUD routes)**
- Success criteria: the routes from Checkpoint 1
- Notes: enforce `requireAbility` + account-scoping per AGENT_CONTRACT.md

Let `/build-feature` run its six checkpoints. The gate is `bun run validate` — do not proceed to Checkpoint 3 until it's green.

## Checkpoint 3 — Regenerate the typed client (in `ui-template/`)

```bash
cd ../ui
bun run generate:api
git status -s src/lib/api/
```

`generate:api` reads the api's OpenAPI spec (the api must be running locally OR the spec file must be checked in — verify which pattern this fork uses). It rewrites `src/lib/api/types.ts` (the generated types) and any client surface.

Confirm the new resource shows up in the generated paths. If the diff is empty, the api wasn't running or the spec wasn't regenerated — STOP and surface this.

CI runs `bun run generate:api:check`, the dry-run variant. If `:check` shows drift after a merge, the operator forgot this step.

## Checkpoint 4 — ui half (still in `ui-template/`)

Dispatch `/build-feature` with:

- Feature kind: **New page (route + feature folder)** (or **Wiring an existing API endpoint into the UI** if no new page is needed)
- Success criteria: from Checkpoint 1's ui shape
- Notes: this feature already has typed bindings — the ui's `apiClient.GET("/api/<resource>")` should typecheck immediately

The skill's Checkpoint 4 (tests first) is where you encode "list renders the records the api would have returned." Mock the OpenAPI client at the call site (e.g. `vi.mock("@/lib/api/client")` returning typed payloads from your `*.queries.ts` test setup).

Run `bun run validate` as the gate.

## Checkpoint 5 — Cross-cutting verify

Both halves pass their gates. Now a sanity end-to-end:

```bash
# in compose root
cd ../../infra/compose
./scripts/compose-up.sh
```

Open the ui at `http://localhost:7331/`, sign in (or use seed creds), navigate to the new feature route. Confirm:

- The list renders without errors
- A create form (if added) posts and the new row appears
- Cross-account scoping holds: log in as a different account; the new resource is empty

## Checkpoint 6 — Diff summary

For each repo:

```bash
git status -s
git diff --stat $(git merge-base HEAD origin/main)..HEAD
```

End with:

- ✓ "Full feature `<Name>` shipped. api +N files / +M tests; ui +P files / +Q tests. Ready to commit each half separately."
- ✗ "<step> failed; needs human attention before commit."

For any feature touching auth, billing, or multi-tenant data, mention `/security-review` in both repos as an optional pre-commit pass.

Do NOT run `git commit`, `git push`, or `gh pr create`. Each half is its own commit boundary; the user owns both.
