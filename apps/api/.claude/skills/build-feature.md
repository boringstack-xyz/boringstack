---
name: build-feature
description: Use when implementing a new feature in apps/api — adding an endpoint, scaffolding a CRUD resource, wiring a BullMQ job, adding a notification event, an ACL feature flag, an audit-log event, or a vertical backend slice. Drives the canonical loop — spec → plan → scaffold → tests-first → implement → `bun run validate` → diff summary. Triggers — "add a feature", "add an endpoint", "scaffold a resource", "build [X]", "add CRUD for", "I need an endpoint for", "wire up [X]", "add a queue", "add a job", "add a notification event", "new resource", "new route", "create the [X] service".
---

# Build feature (apps/api)

You are implementing a new backend feature end-to-end. The loop has six checkpoints. Don't skip ahead — each step's output informs the next. The merge gate is `bun run validate`; pre-1.0 rules apply (no deprecated code, no historical comments, no inline `eslint-disable`, no PII in audit-log `metadata`, no `process.env` outside `src/config/env/**`).

## Checkpoint 1 — Spec

Before asking anything, check whether the spec loop is active:

1. Look for `.specs/next.md` at the repo root.
2. If it exists, read it. If frontmatter contains `status: approved`,
   the user has already done the spec work — use **Problem**,
   **Slice**, **Design decisions**, and **Verification contract** as
   the answers to the three questions below. Do NOT re-interview.
3. If the spec exists but `status` is still `draft`, STOP. Tell the
   user to finish `slice` and `approve` before running this skill.
4. If `.specs/next.md` doesn't exist, fall through to the interview:

Ask the user (or restate from context) in this order:

1. **What is the feature?** One sentence.
2. **What kind?** Pick the closest; multiple OK for full-stack.
   - DB-backed resource (table + CRUD routes)
   - Endpoint(s) on an existing resource
   - Background job (BullMQ)
   - Notification event
   - ACL feature flag (`can_X` boolean or `<X>_limit` int)
   - Audit-log event only
3. **What does success look like?** User-visible behavior. Becomes test expectations in Checkpoint 4.

Print a one-line summary. Stop until the user confirms.

## Checkpoint 2 — Plan

Map the spec onto scaffolders + glue points.

| Need                      | Command                                                |
| ------------------------- | ------------------------------------------------------ |
| DB resource + CRUD routes | `bun run new:resource -- <Name>`                       |
| ACL feature flag          | `bun run new:feature <key> <boolean\|limit> <default>` |
| Notification event        | `bun run new:notification-event -- <eventType>`        |
| ACL action                | `bun run new:action <name>`                            |
| ACL role                  | `bun run new:role <name>`                              |
| ACL subject               | `bun run new:subject <name>`                           |

Print:

- Which scaffolder(s) will run, with exact arguments.
- Manual files that need touching (wiring a new resource into its parent route group, regenerating OpenAPI, adding a worker to `src/jobs/index.ts`).
- Tests that will need writing — `lint:meta` requires a sibling test for every `*.{service,utils,jobs,check,routes}.ts`.

Stop. Get explicit user agreement before running anything.

## Checkpoint 3 — Scaffold

Run the scaffolder command(s) verbatim from Checkpoint 2. Then:

```bash
git status -s
```

Print the new files. If anything's missing, in an unexpected path, or not paired with a sibling, STOP and surface it to the user.

## Checkpoint 4 — Tests first

For every `*.{service,utils,jobs,check,routes}.ts` from Checkpoint 3, populate the sibling `*.test.ts` with assertions that encode the Checkpoint 1 success criteria. Empty test files are not allowed — `lint:meta` rejects them at the gate.

Run just the new tests to confirm they fail as expected:

```bash
bun test src/<feature-path>
```

Red here is correct. Green means the test isn't actually exercising the new behavior — fix the test before writing the implementation.

## Checkpoint 5 — Implement

Fill in the service/routes/job bodies. The AGENT_CONTRACT.md rules that catch the most footguns:

- **Routes**: every handler that writes calls `requireAbility(ability, subject)` or `requireFreshMembership` before the DB call. The `route-must-check-ability` ESLint rule enforces it — but write it yourself; don't trust autofix.
- **Account-scoped tables**: every `db.select/update/delete` includes `.where(eq(<table>.accountId, ctx.accountId))`. The `account-scoped-tables-require-where` rule enforces it.
- **Mutations**: emit `auditLog.write` with no-PII metadata — IDs and enums only.
- **External calls**: throw `ApiErrors.externalService("provider", error)` with the underlying error passed as `cause`.
- **BullMQ jobs**: deterministic job key derived from a stable input (e.g. `<event_type>:<resource_id>`). Never `crypto.randomUUID()` — retries must dedupe.
- **Errors**: use `ApiErrors.*` factories. Never `new ApiError(...)` inline.
- **Stripe webhooks** (if relevant): `constructEventAsync` only; verify before any DB write.

Re-run the new-file tests until green:

```bash
bun test src/<feature-path>
```

## Checkpoint 6 — Verify

Full merge gate:

```bash
bun run validate
```

That's `typecheck → lint → lint:meta → knip → bun test`. If any step fails, print the failure and fix in place. Don't push partial work past the gate.

When `bun run validate` is fully green:

```bash
git status -s
git diff --stat $(git merge-base HEAD origin/main)..HEAD
```

End with one of:

- ✓ "Feature `<name>` shipped. <N> files changed, <M> tests added. Ready to commit."
- ✗ "<step> failed; needs human attention before commit."

For non-trivial features (auth surface, billing, multi-tenant data), the user may want to dispatch `/security-review` before committing. Mention it; don't run it unless asked.

Do NOT run `git commit`, `git push`, or `gh pr create`. The user owns the commit boundary.
