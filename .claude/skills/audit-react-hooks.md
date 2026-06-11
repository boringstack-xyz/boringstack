---
name: audit-react-hooks
description: Use when an agent needs a focused, machine-consumable audit of React hooks in apps/ui — effect dependency arrays, stale closures, memoization / render-identity churn, callback stability, effect cleanup, rules-of-hooks edge cases. Read-only; emits one JSON artifact a follow-up coding agent can execute. Triggers — "audit react hooks", "check useEffect deps", "find stale closures", "audit memoization / re-renders", "review hook cleanup", "audit-react-hooks".
---

# Audit react hooks (agent-to-agent)

You are producing a **React-hooks** audit of `apps/ui` **for another AI agent to execute**
(the `execute-audit` skill). Optimize for token efficiency and machine consumption. Output
is a single JSON file. Stay in the hooks/render-correctness lane — data fetching/caching is
`audit-react-data`; bundle size/build is `audit-dependencies`/other audits.

## Iron rules

1. **Read-only.** No edits except the one artifact. No builds/test runs. Static analysis
   only: read files + targeted `grep`/`rg`. `eslint`/`knip` read-only only if you cite exact
   output (note: `eslint-plugin-react-hooks` already runs in CI — only report what it does
   NOT catch, or a gap in its config).
2. **Evidence or it doesn't ship.** Every finding cites exact `file` + `lines_or_symbol`
   (hook + the dep array / closure). No path → `blocked_or_uncertain`.
3. **Precision over volume.** A real correctness or measurable-perf hook bug beats ten
   "could memoize" nits. Memoization findings must name a concrete consequence (identity
   churn into a memoized child / effect, expensive recompute), not "best practice".
4. **No prose outside JSON.** Only chat output: artifact path + one-line count.
5. **Rank for an autonomous agent** (safe-first) in `execution_plan`.
6. **Guardrail-first.** Most hook-dependency bugs are owned by the cross-repo
   `eslint-plugin-react-hooks`; if a finding is a class that plugin/config should catch but
   doesn't, the gap IS the finding — record it and propose tightening the ESLint config
   (e.g. `react-hooks/exhaustive-deps` from warn→error, `additionalHooks` regex for custom
   hooks). lint-meta (apps/ui) can enforce source-text bans where ESLint can't reach.

## Scope (read only these)

- `apps/ui/src/hooks/**` (shared hooks, e.g. `*.hooks.ts`)
- `apps/ui/src/features/**/*.tsx` and `**/use*.ts(x)` (feature components + their local hooks)
- `apps/ui/src/components/**` (shared components with hooks; skip generated `components/ui/**`
  shadcn primitives unless a hook bug is clear)
- `apps/ui/src/app/providers/**`, `apps/ui/src/store/**` (context/store hooks)
- `apps/ui/eslint.config.js` (to see how `react-hooks` rules are configured)

## What to hunt (hooks calibration for THIS repo)

- **high** — effect with a missing/incorrect dependency that causes a stale closure or a
  missed re-run (subscription/listener reading stale state; fetch keyed on a value not in
  deps); effect that mutates state every render → infinite loop / render storm; `useEffect`
  missing a cleanup for a subscription/timer/listener/abort (leak); a derived value or
  callback rebuilt every render and passed as a prop INTO a `React.memo` child or as a dep
  of another hook (defeats memoization / re-fires effects) — the F002-class issue this repo
  has hit before (`AppSidebar` nav identity churn).
- **medium** — `useMemo`/`useCallback` with wrong/empty deps that capture stale values;
  expensive computation (sort/filter/map over a large list, JSON parse, regex compile) run
  unmemoized in render; conditional hook calls / hooks inside loops or after early return
  (rules-of-hooks); state derivable from props/other state stored redundantly (sync-effect
  anti-pattern) — prefer derive-in-render.
- **low** — over-memoization with no consequence (drop it); `useState` initializer doing
  work every render (should be lazy init `useState(() => …)`).

For EACH finding decide the guardrail: is it a class `react-hooks/exhaustive-deps` would
catch if set to `error` with the right `additionalHooks`? Say so. If it's genuinely beyond
ESLint (e.g. "this value should be memoized because it flows into a memo child"), set
`enforceable:false` or propose a narrow lint-meta source-text rule.

Do NOT report: data-fetching/query-key issues (→ `audit-react-data`), styling, anything the
formatter or `react-hooks` plugin already flags as an error, or speculative "might re-render"
with no memoized consumer.

## Process

### 1. Map (cheap, inline)
Read `eslint.config.js` for the `react-hooks` setup (warn vs error, `additionalHooks`), and
one feature folder (`features/<x>/components/...`) + `src/hooks/**` to learn the hook
conventions (custom `use*` hooks, where memoization is already applied).

### 2. Fan out (parallel subagents — one Agent call per cell, single message)
| Cell | Scope | Focus |
| ---- | ----- | ----- |
| shared-hooks | `src/hooks/**`, `src/app/providers/**`, `src/store/**` | deps correctness, cleanup, context value identity churn |
| feature-effects | `src/features/**/*.tsx`, feature `use*.ts(x)` | stale closures, missing deps, render-loop mutations, cleanup |
| memoization | components passing props to memoized children / hook deps | identity churn defeating memo/effect; unmemoized expensive compute |

Orders verbatim: *read-only; cite exact file + hook + dep array; every memoization finding
must name the concrete consumer that suffers; set `guardrail` (ESLint config tighten or
`enforceable:false`); return a JSON array ONLY; weak evidence → `blocked`; hooks lane only.*

### 3. Merge + rank
Dedupe by file+hook. IDs `F001`… by severity then effort. `validation` = a real command:
`cd apps/ui && bun run check` / `bun run test:ci` / `bun test <path>`, or a targeted `grep`.
`quick_wins` = `effort:"S"` and severity ≥ medium.

### 4. Emit
Write to `.audit/react-hooks/audit-report.json` (create dir; gitignored — per-domain path so
concurrent scoped audits don't clobber). Print ONLY path + counts, e.g.
`Wrote .audit/react-hooks/audit-report.json — 5 findings (2 high), 2 quick wins, 1 blocked.`

## Output schema (valid JSON, identical to audit-monorepo so execute-audit consumes it)

```json
{
  "repo_map": { "apps": [], "build_system": "", "test_system": "", "ci": [], "critical_paths": [] },
  "domain": "react-hooks",
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
- A memoization finding doesn't name the memoized child/effect that suffers from churn.
- You reported something `react-hooks/exhaustive-deps` already errors on (no value added).
- You reported query/cache behavior (that's `audit-react-data`) or styling.
- A class ESLint config could catch has `guardrail` left unset.
- You skipped fan-out or wrote prose in chat instead of the JSON file.
