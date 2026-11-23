---
name: audit-tests-coverage
description: Use when an agent needs a focused, machine-consumable audit of test coverage and quality across apps — missing sibling tests on logic modules, weak/assertion-light tests, skipped tests without tracking, coverage-ratchet gaps, and untested critical paths. Read-only; emits one JSON artifact a follow-up coding agent can execute. Triggers — "audit tests", "audit test coverage", "find missing tests", "check for untested services", "review skipped tests", "audit-tests-coverage".
---

# Audit tests coverage (agent-to-agent)

You are producing a **testing/coverage** audit across `apps/api` and `apps/ui` **for another
AI agent to execute** (the `execute-audit` skill). Optimize for token efficiency and machine
consumption. Output is a single JSON file. Stay in the testing lane.

## Iron rules

1. **Read-only.** No edits except the one artifact. No test runs. Static analysis only: read
   files + targeted `grep`/`rg`/`ls`. `bun run lint:meta` read-only only if you cite exact
   output (it enforces test-sibling coverage).
2. **Evidence or it doesn't ship.** A "missing test" finding cites the exact source file
   lacking a sibling test (and the path the sibling should live at). No path →
   `blocked_or_uncertain`.
3. **Precision over volume.** Prioritize untested SECURITY/tenancy/money logic over trivial
   util gaps. A weak-test finding must quote the assertion-light test, not just assert it.
4. **No prose outside JSON.** Only chat output: artifact path + one-line count.
5. **Rank for an autonomous agent** (safe-first) in `execution_plan`.
6. **Guardrail-first.** Test-sibling coverage is ALREADY enforced by lint-meta:
   `logic-files-require-test-sibling` (matches `*.{service,utils,jobs,check,channel,helpers}.ts`
   and anything under `src/lib/{metrics,tracing,acl}`), `routes-require-test-sibling`,
   `touch-tests-too`, and `skipped-tests-need-tracking`. If a logic file genuinely lacks a
   test, EITHER the rule's suffix set has a gap (extend it) OR the file is excluded — say
   which in `guardrail.note`. For UI, propose the analogous lint-meta rule if missing.

## Scope (read only these)

- **api**: `apps/api/src/**` (find every `*.{service,routes,jobs,check,utils,channel,helpers}.ts`
  and `src/lib/{metrics,tracing,acl}/**`), `apps/api/tests/**`,
  `apps/api/scripts/quality/**` (coverage runner + floor), `apps/api/scripts/lint-meta/rules/testing/**`
- **ui**: `apps/ui/src/**` (hooks/services/utils + `*.queries.ts`/`*.mutations.ts`),
  `apps/ui/tests/**`, `apps/ui/vitest.config.ts` (coverage thresholds + excludes),
  `apps/ui/e2e/**` (Playwright critical-path coverage)
- both: `*.test.ts(x)` siblings, `it.skip`/`test.skip`/`describe.skip`/`xit` occurrences

## What to hunt (testing calibration for THIS repo)

- **high** — a SECURITY/tenancy/billing logic module with no sibling test (auth, ability
  checks, accountId scoping, Stripe/seat/balance, ownership transfer) — untested money/
  isolation code is the worst gap; a `*.skip`/`xit` test on a critical path with NO tracking
  comment/issue (silently disabled coverage — `skipped-tests-need-tracking` should catch it,
  flag the gap if not); a test that asserts nothing meaningful (`expect(x).toBeDefined()`
  over real behavior) guarding critical logic.
- **medium** — a non-critical `*.{service,utils,jobs,check}.ts` missing its sibling test;
  coverage-exclude list that hides a logic module (cite `vitest.config.ts`/coverage runner);
  a critical user journey (login, accept invite, checkout) with no Playwright e2e; tests
  coupled to implementation (snapshot of internals) that won't catch real regressions.
- **low** — missing edge-case tests (error branch, empty/boundary input) on otherwise-tested
  modules; flaky-prone patterns (real timers, ordering assumptions).

For EACH finding decide the guardrail: does an existing test-sibling rule already cover this
suffix? If a real logic file slipped, name the rule + the gap (suffix not matched, or wrongly
excluded). For UI, propose `ui-logic-files-require-test-sibling` if no equivalent exists.

Do NOT report: tests for `*.types.ts`/`*.constants.ts`/`*.schemas.ts` (no logic), generated
files, or coverage % vanity targets with no specific untested path.

## Process

### 1. Map (cheap, inline)
Read `logic-files-require-test-sibling.ts` (the suffix set + exclusions) and the api/ui
coverage runners (`scripts/quality/**`, `vitest.config.ts`) to learn what's enforced and
what's excluded. Run `bun run lint:meta` read-only in apps/api to confirm current sibling
coverage is green (so any gap you find is an EXCLUSION/suffix gap, not an unfixed violation).

### 2. Fan out (parallel subagents — one Agent call per cell, single message)
| Cell | Scope | Focus |
| ---- | ----- | ----- |
| api-coverage | `apps/api/src/**`, `apps/api/tests/**` | logic modules missing/weak siblings (prioritize security/tenancy/billing); skipped tests untracked |
| ui-coverage | `apps/ui/src/**`, `apps/ui/tests/**`, `e2e/**` | hooks/queries/mutations/utils missing tests; critical-journey e2e gaps; coverage excludes |
| coverage-config | `vitest.config.ts`, `scripts/quality/**`, `lint-meta/rules/testing/**` | exclude lists hiding logic; ratchet/floor gaps; suffix-set gaps in the sibling rules |

Orders verbatim: *read-only; cite the exact source file lacking a test (and where the sibling
should be); quote assertion-light tests; map each gap to an existing test-sibling rule
(suffix/exclusion gap) or a proposed one; return a JSON array ONLY; weak evidence →
`blocked`; testing lane only.*

### 3. Merge + rank
Dedupe by source file. IDs `F001`… by severity then effort. `validation` = a real command:
`cd apps/api && bun run lint:meta` / `bun test <path>` / `bun run test:coverage`,
`cd apps/ui && bun run test:ci` / `bun test <path>`, or a targeted `ls`/`grep` asserting the
sibling exists. `quick_wins` = `effort:"S"` and severity ≥ medium.

### 4. Emit
Write to `.audit/tests-coverage/audit-report.json` (create dir; gitignored — per-domain path
so concurrent scoped audits don't clobber). Print ONLY path + counts, e.g.
`Wrote .audit/tests-coverage/audit-report.json — 7 findings (3 high), 3 quick wins, 1 blocked.`

## Output schema (valid JSON, identical to audit-monorepo so execute-audit consumes it)

```json
{
  "repo_map": { "apps": [], "build_system": "", "test_system": "", "ci": [], "critical_paths": [] },
  "domain": "tests-coverage",
  "findings": [
    {
      "id": "F001",
      "severity": "critical|high|medium|low",
      "effort": "S|M|L",
      "category": "testing",
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
- A "missing test" finding doesn't name the exact source file (and where the sibling goes).
- You reported missing tests for `*.types.ts`/`*.constants.ts`/`*.schemas.ts` or generated files.
- A weak-test finding doesn't quote the assertion-light test.
- A real logic-file gap doesn't say whether it's a suffix-set or exclusion gap in the sibling rule.
- You skipped fan-out or wrote prose in chat instead of the JSON file.
