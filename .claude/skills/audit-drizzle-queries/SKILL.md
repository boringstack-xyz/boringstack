---
name: audit-drizzle-queries
description: Use when an agent needs a focused, machine-consumable audit of the apps/api Drizzle data layer — N+1 patterns, missing indexes, transaction boundaries, multi-tenant accountId scoping in queries, raw-SQL safety, pagination correctness. Read-only; emits one JSON artifact a follow-up coding agent can execute. Triggers — "audit drizzle queries", "audit the db layer", "find N+1 queries", "check missing indexes", "review transactions", "audit query account scoping", "audit-drizzle-queries".
---

# Audit drizzle queries (agent-to-agent)

You are producing a **database/query-layer** audit of `apps/api` **for another AI agent to
execute** (the `execute-audit` skill). Optimize for token efficiency and machine
consumption. Output is a single JSON file. Stay in the data-layer lane — HTTP/auth shape
belongs to `audit-api-security`; only query-level tenant scoping is in scope here.

## Iron rules

1. **Read-only.** No edits except the one artifact. No builds/migrations/test runs.
   Static analysis only: read files + targeted `grep`/`rg`. `eslint`/`knip` read-only only
   if you cite exact output.
2. **Evidence or it doesn't ship.** Every finding cites exact `file` + `lines_or_symbol`.
   No path → `blocked_or_uncertain`. For an index finding, cite BOTH the query (filter/join
   column) AND the schema column that lacks the index.
3. **Precision over volume.** Verified, high-leverage findings only.
4. **No prose outside JSON.** Only chat output: artifact path + one-line count.
5. **Rank for an autonomous agent** (safe-first) in `execution_plan`.
6. **Guardrail-first.** Decide if a static check could catch the class and fill
   `guardrail`. lint-meta candidates: `tenant-tables-require-accountId-filter`,
   `no-query-in-loop` (N+1), `no-sql-raw-with-interpolation`,
   `mutation-must-run-in-transaction`. eslint-plugin already forbids `drizzle-orm` imports
   in `*.routes.ts`/`*.schemas.ts` — note gaps if a route reaches the DB directly.

## Scope (read only these)

- `apps/api/src/clients/postgres/**` — the Drizzle client (`index.ts`) and
  `schema/*.schema.ts` (app, auth, billing, memberships, audit, notifications),
  `schema/relations.ts`, `schema/index.ts`
- `apps/api/src/api/**/*.service.ts` and `*.utils.ts` — every module that imports `db` and
  builds queries (services are the only layer allowed to touch `drizzle-orm`)
- `apps/api/drizzle/**` — generated migrations + `meta/` (to confirm indexes that exist)
- `apps/api/src/api/dashboard/**`, `apps/api/src/api/accounts/**` (heaviest query surfaces)

## What to hunt (data-layer calibration for THIS repo)

The repo is multi-tenant: rows belong to an account via `accountId`/`targetAccountId`.
Tenant isolation at the QUERY level is the highest-value class here (a recent leak shipped
because dashboard audit-log reads filtered by `userId` only, not `accountId`).

- **critical** — a query on a tenant-scoped table with NO `accountId` predicate (cross-
  account read/write); a cursor/`id`-based pagination that doesn't re-scope the cursor to
  the caller's account; `sql.raw`/`sql\`\`` built from user input (injection); a destructive
  `delete`/`update` missing its `where` (full-table mutation).
- **high** — N+1: a DB call inside a `for`/`map`/`Promise.all(items.map(...))` that could be
  a single `inArray`/join; a multi-statement mutation (read-modify-write, balance/seat
  changes, ownership transfer) not wrapped in `db.transaction(tx)` (race / partial write);
  a hot filter/order/join column with no index (cite the schema line); missing `FOR UPDATE`
  on a row that's read then conditionally written.
- **medium** — `SELECT *`/over-fetch on wide tables where a column list is cheap;
  unbounded query (no `limit`) on a user-growable table; offset pagination on a large table
  where keyset exists; inconsistent soft-delete handling.
- **low** — query built in a route/util that belongs in a service; duplicated query logic
  that should be a shared helper.

Index check method: for each `where eq(col, …)`, `orderBy(col)`, or join key in a service,
confirm a matching `index()`/`uniqueIndex()` in the relevant `*.schema.ts` or a covering
index in `drizzle/meta`. Report only when the column is on a query path AND unindexed.

Do NOT report: micro-optimizations with no measurable cost, style, or anything ESLint
already enforces (e.g. drizzle imports in routes — only report if the ban was bypassed).

## Process

### 1. Map (cheap, inline)
Read `src/clients/postgres/index.ts` (how `db`/`tx` are exposed) and one heavy service
(`accounts.service.ts` or `dashboard.service.ts`) to learn the query idioms (scoping
helpers, transaction usage, pagination shape). Skim `schema/*.schema.ts` for existing
`index()` declarations.

### 2. Fan out (parallel subagents — one Agent call per cell, single message)
| Cell | Scope | Focus |
| ---- | ----- | ----- |
| tenant-scoping | all `*.service.ts` querying tenant tables | every query has an accountId predicate; cursor re-scoping; IDOR-by-query |
| n1-and-tx | all `*.service.ts`/`*.utils.ts` | DB calls in loops (N+1); read-modify-write without transaction; missing FOR UPDATE |
| indexes-schema | `schema/*.schema.ts`, `drizzle/meta`, cross-ref query filters | filter/order/join columns lacking an index; over-fetch; unbounded queries |
| raw-sql | grep `sql\``/`sql.raw`/`execute(` across services | interpolation/injection; destructive ops missing where |

Orders verbatim to each subagent: *read-only; cite exact file + line/symbol; for index
findings cite both query and schema; set `guardrail`; return a JSON array of finding
objects ONLY; weak evidence → `blocked` array; data-layer lane only.*

### 3. Merge + rank
Dedupe by file+symbol. IDs `F001`… by severity then effort. `validation` = a real command:
`cd apps/api && bun run check` / `bun test <path>` / `bun run lint:meta`, or a targeted
`grep`/schema assertion. (Index fixes also imply `bun run db:generate` + committing SQL —
put that in `execution_steps`, never invent it as `validation`.) `quick_wins` = `effort:"S"`
and severity ≥ medium.

### 4. Emit
Write to `.audit/drizzle-queries/audit-report.json` (create dir; gitignored — per-domain
path so concurrent scoped audits don't clobber). Print ONLY path + counts, e.g.
`Wrote .audit/drizzle-queries/audit-report.json — 6 findings (1 critical, 2 high), 1 quick win, 1 blocked.`

## Output schema (valid JSON, identical to audit-monorepo so execute-audit consumes it)

```json
{
  "repo_map": { "apps": [], "build_system": "", "test_system": "", "ci": [], "critical_paths": [] },
  "domain": "drizzle-queries",
  "findings": [
    {
      "id": "F001",
      "severity": "critical|high|medium|low",
      "effort": "S|M|L",
      "category": "security|performance|reliability|architecture",
      "title": "",
      "evidence": [ { "file": "", "lines_or_symbol": "", "problem": "" } ],
      "impact": "",
      "fix": "",
      "execution_steps": [],
      "validation": "",
      "guardrail": { "enforceable": true, "layer": "lint-meta|eslint-plugin|none", "rule": "", "note": "" }
    }
  ],
  "execution_plan": [ { "order": 1, "finding_id": "F001", "why_now": "", "files_to_change": [], "commands_to_run": [] } ],
  "quick_wins": [],
  "blocked_or_uncertain": [ { "topic": "", "missing_evidence": "", "how_to_verify": "" } ]
}
```

## Red flags — you are doing it wrong if
- An index finding cites the query but not the unindexed schema column (or vice versa).
- A tenant-scoping finding has no exact query line. (→ `blocked_or_uncertain`.)
- You put `db:generate`/`db:migrate` in `validation` (they're `execution_steps`).
- You reported HTTP/auth shape (that's `audit-api-security`) or style/DX.
- You skipped fan-out, or wrote prose in chat instead of the JSON file.
