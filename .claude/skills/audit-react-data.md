---
name: audit-react-data
description: Use when an agent needs a focused, machine-consumable audit of data fetching and forms in apps/ui — TanStack Query keys/caching/invalidation, mutation + optimistic-update correctness, loading/error states, and React Hook Form + Zod form validation. Read-only; emits one JSON artifact a follow-up coding agent can execute. Triggers — "audit react data fetching", "audit tanstack query", "check query keys / invalidation", "audit forms / RHF / zod", "review mutations and optimistic updates", "audit-react-data".
---

# Audit react data (agent-to-agent)

You are producing a **data-fetching + forms** audit of `apps/ui` **for another AI agent to
execute** (the `execute-audit` skill). Optimize for token efficiency and machine
consumption. Output is a single JSON file. Stay in the query/mutation/forms lane — raw hook
dependency/render correctness is `audit-react-hooks`.

## Iron rules

1. **Read-only.** No edits except the one artifact. No builds/test runs. Static analysis
   only: read files + targeted `grep`/`rg`. `eslint`/`knip` read-only only if you cite exact
   output.
2. **Evidence or it doesn't ship.** Every finding cites exact `file` + `lines_or_symbol`
   (the `useQuery`/`useMutation`/`useForm` call). No path → `blocked_or_uncertain`.
3. **Precision over volume.** Verified correctness/UX bugs (stale cache, missing
   invalidation, unhandled error) beat generic "add a loading spinner" notes.
4. **No prose outside JSON.** Only chat output: artifact path + one-line count.
5. **Rank for an autonomous agent** (safe-first) in `execution_plan`.
6. **Guardrail-first.** lint-meta candidates (apps/ui `scripts/lint-meta/rules/`):
   `query-keys-from-central-factory` (no inline array keys), `mutation-must-invalidate-or-comment`,
   `forms-must-use-zodResolver`. Note where a convention exists but isn't enforced.

## Scope (read only these)

- `apps/ui/src/features/**/*.queries.ts`, `*.queries.utils.ts`, `*.mutations.ts` (the repo
  groups query/mutation logic in these files, e.g. `Auth.queries.ts`, `Auth.signup.mutations.ts`)
- `apps/ui/src/app/providers/QueryProvider.tsx` (QueryClient defaults: staleTime, retry, gc)
- `apps/ui/src/hooks/**` (data hooks like `useWebPush.hooks.ts`)
- form components under `apps/ui/src/features/**/components/**` using `useForm` + `zodResolver`
  and the shared `apps/ui/src/components/ui/form.tsx`
- `apps/ui/src/lib/api/**` (generated `schema.d.ts` + the typed client the queries call)

## What to hunt (data/forms calibration for THIS repo)

**TanStack Query**
- **high** — query key that doesn't include every input it depends on (caches across
  different params → wrong data shown); a mutation that changes server state but never
  `invalidateQueries`/`setQueryData` (stale UI until refetch); optimistic update with no
  rollback `onError` (UI shows a write that failed); fetching in `useEffect` + `setState`
  instead of `useQuery` (loses cache/dedupe/retry); `enabled` missing on a query that needs
  a precondition (fires with undefined args).
- **medium** — inconsistent/inline query keys that should come from a key factory (drift →
  invalidation misses); unhandled `isError` (silent failure / blank screen); over-eager
  `refetchOnWindowFocus`/`staleTime: 0` on expensive endpoints; mutation success not
  surfaced to the user; duplicate queries for the same resource with divergent keys.
- **low** — missing `select` to narrow re-renders; `gcTime`/`staleTime` left default where a
  deliberate value is warranted.

**React Hook Form + Zod**
- **high** — form submits without `zodResolver` (client validation bypassed); schema diverges
  from the API contract (`lib/api` types) so valid-looking input fails server-side; uncontrolled
  ↔ controlled input warnings from missing defaults; submit handler not disabled while
  `isSubmitting` (double-submit / duplicate mutation).
- **medium** — error messages not wired to fields (`formState.errors` unused); no reset after
  success; numeric/date coercion missing in the Zod schema.

Do NOT report: raw hook-deps/render churn (→ `audit-react-hooks`), styling, copy, or
anything the formatter/ESLint already enforces.

## Process

### 1. Map (cheap, inline)
Read `QueryProvider.tsx` (global defaults), one `*.queries.ts` + its `*.mutations.ts`
(key/invalidation idioms), and one RHF form component (how `zodResolver` + `form.tsx` are
wired). Learn whether a query-key factory exists.

### 2. Fan out (parallel subagents — one Agent call per cell, single message)
| Cell | Scope | Focus |
| ---- | ----- | ----- |
| query-cache | `*.queries.ts`, `*.queries.utils.ts`, `QueryProvider.tsx`, data hooks | key correctness, staleness, `enabled`, error/loading handling |
| mutations | `*.mutations.ts` | invalidation/`setQueryData`, optimistic rollback, double-submit, success UX |
| forms | RHF + zod components, `components/ui/form.tsx`, `lib/api` types | zodResolver presence, schema↔contract drift, error wiring, submit guards |

Orders verbatim: *read-only; cite exact file + call site; set `guardrail`; return a JSON
array of finding objects ONLY; weak evidence → `blocked`; data/forms lane only.*

### 3. Merge + rank
Dedupe by file+symbol. IDs `F001`… by severity then effort. `validation` = a real command:
`cd apps/ui && bun run check` / `bun run test:ci` / `bun test <path>`, or a targeted `grep`.
`quick_wins` = `effort:"S"` and severity ≥ medium.

### 4. Emit
Write to `.audit/react-data/audit-report.json` (create dir; gitignored — per-domain path so
concurrent scoped audits don't clobber). Print ONLY path + counts, e.g.
`Wrote .audit/react-data/audit-report.json — 6 findings (3 high), 2 quick wins, 1 blocked.`

## Output schema (valid JSON, identical to audit-monorepo so execute-audit consumes it)

```json
{
  "repo_map": { "apps": [], "build_system": "", "test_system": "", "ci": [], "critical_paths": [] },
  "domain": "react-data",
  "findings": [
    {
      "id": "F001",
      "severity": "critical|high|medium|low",
      "effort": "S|M|L",
      "category": "reliability|performance|code_quality",
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
- A cache/invalidation finding has no exact `useQuery`/`useMutation` line.
- You reported raw hook-deps/render churn (that's `audit-react-hooks`) or styling.
- A form finding doesn't show the missing `zodResolver` or the schema↔contract mismatch.
- You skipped fan-out or wrote prose in chat instead of the JSON file.
