---
name: audit-monorepo
description: Use when an agent (not a human) needs a full, machine-consumable audit of this monorepo before fixing it — apps/api, apps/ui, apps/docs, infra/, scripts/, .github CI, and root configs. Produces evidence-backed findings as a single JSON artifact that a follow-up coding agent can execute against. Read-only; never edits code. Triggers — "audit the monorepo", "full review of the repo", "audit apps/api + apps/ui + apps/docs", "find executable improvements", "give me a JSON audit", "review the repo for an agent to fix", "what should we fix first", "produce an audit report".
---

# Audit monorepo (agent-to-agent)

You are producing an audit **for another AI agent to execute**, not for a human to
read. Optimize the run for token efficiency and the output for machine consumption.
The output is a single JSON file. No essays, no praise, no generic advice.

## Iron rules

1. **Read-only.** Do not edit, create, or delete any repo file except the one output
   artifact. Do not run builds, installs, migrations, or test suites (slow, need
   Docker). Static analysis only: read files + targeted `grep`/`rg`/`ls`. You MAY run
   a fast, already-configured read-only analyzer (`knip`, `eslint`) ONLY if you cite
   its exact output as evidence — never as a substitute for reading.
2. **Evidence or it doesn't ship.** Every finding cites exact `file` + `lines_or_symbol`
   + the concrete `problem`. No file path → it goes in `blocked_or_uncertain`, not
   `findings`.
3. **Precision over volume.** 10 verified, high-leverage findings beat 50 vague ones.
   Drop anything you can't back with code/config you actually read.
4. **No prose outside JSON.** The only chat output is the artifact path + a one-line
   count summary. Everything else is in the file.
5. **Rank for an autonomous agent**, not a human reviewer: order `execution_plan` by
   what a coding agent should safely execute first (low blast radius, unblocks others,
   verifiable).
6. **Guardrail-first mindset (lint as a contract).** This stack prevents defects with
   linters and parsers, not review. For every finding, decide whether it is a _class_ a
   static check could catch and fill `guardrail` (which layer, which rule to add/extend).
   If a guardrail already _claims_ the class but the finding slipped through, that gap IS
   part of the finding — say so in `guardrail.note`. The executor adds the rule before
   fixing, so your job is to point it at the right layer. The two layers:
   - **lint-meta** (in-repo, editable: `apps/<app>/scripts/lint-meta/rules/<category>/`) —
     repo-level drift: version/SHA pins, CI parity, env cascade, source-text bans,
     test-sibling coverage, config.
   - **eslint-plugin** (`@boring-stack-pkg/eslint-plugin-*`, cross-repo) — architecture
     _inside_ TypeScript modules. Note it, but it can't be edited from this repo.

## Process

### 1. Map (cheap, do inline)
Derive the repo map by reading: root `package.json` + `scripts/stack-*.sh`, each app's
`package.json` scripts, `.github/workflows/*`, `apps/api/AGENT_CONTRACT.md`. Capture
build system (Bun workspaces orchestrated by `scripts/stack-check.sh`, no Turbo),
test systems (api: `bun test`; ui: `vitest` + Playwright; docs: linkcheck/astro),
and the critical paths (e.g. `apps/api/src/{boot,config,middleware,clients}`,
`apps/api/src/api/{auth,users,billing}`, `apps/ui/src/{app,features,lib}`,
`infra/compose`).

### 2. Fan out (parallel subagents — REQUIRED for efficiency)
Dispatch read-only Explore/general-purpose subagents **in a single message** (one
Agent call per cell). Recommended decomposition (~8 cells; adjust to repo size):

| Cell | Scope | Dimensions |
| ---- | ----- | ---------- |
| api-core | `apps/api/src/{boot,config,middleware,clients,lib}` | architecture, reliability, security |
| api-features | `apps/api/src/api/**`, `apps/api/drizzle` | architecture, security, code_quality |
| api-quality | `apps/api/{tests,scripts,knip.json,eslint.config.js,tsconfig.json}` | testing, build, dx |
| ui-core | `apps/ui/src/**`, `apps/ui/vite.config.ts` | architecture, performance, dx |
| ui-quality | `apps/ui/{tests,e2e,scripts,knip.json,.size-limit.json}` | testing, build, dependencies |
| docs | `apps/docs/**` | build, dependencies, dx |
| infra-ci | `infra/**`, `.github/workflows/**`, `scripts/**` | reliability, security, build |
| cross-cut | root configs, all `package.json` + `bun.lock`, `.env.example` files | dependencies, security |

Give each subagent: its scope paths, its dimensions, the **finding object schema
below**, and these orders verbatim: *read-only; cite exact file + line/symbol for every
finding; for each finding set `guardrail` — could a lint-meta rule or ESLint plugin
enforce this class of defect? name the rule to add or extend, or set `enforceable:false`
for genuine one-offs; return a JSON array of finding objects ONLY (no prose); if evidence
is weak, return it under a `blocked` array instead; prefer precise over vague.*

### 3. Merge + rank (orchestrator)
- Collect all subagent arrays. Dedupe overlapping findings (same file+symbol).
- Assign stable IDs `F001`, `F002`, … ordered by `severity` then `effort`.
- Set each finding's `validation` to a **real repo command** that confirms the fix:
  `cd apps/api && bun run check` / `bun run validate` / `bun test`,
  `cd apps/ui && bun run check` / `bun run test:ci`, `cd apps/docs && bun run build:ci`,
  or a targeted `grep`/file assertion. Never invent commands.
- Build `execution_plan` ordered for an autonomous agent (safe-first, unblock-first).
  Treat `guardrail.enforceable` findings as higher-leverage at equal severity — fixing
  one closes a whole class, not one instance.
- `quick_wins` = finding IDs with `effort: "S"` and severity ≥ medium.
- Anything weak/unverifiable → `blocked_or_uncertain`.

### 4. Emit
Write the JSON to `.audit/audit-report.json` (create the dir; it is gitignored).
Print to chat ONLY: the path and counts, e.g.
`Wrote .audit/audit-report.json — 14 findings (2 critical, 5 high), 4 quick wins, 3 blocked.`

## Output schema (the file content — valid JSON, no markdown)

```json
{
  "repo_map": {
    "apps": [],
    "packages": [],
    "build_system": "",
    "test_system": "",
    "ci": [],
    "critical_paths": []
  },
  "findings": [
    {
      "id": "F001",
      "severity": "critical|high|medium|low",
      "effort": "S|M|L",
      "category": "architecture|performance|security|reliability|testing|dx|dependencies|build|code_quality",
      "title": "",
      "evidence": [
        { "file": "", "lines_or_symbol": "", "problem": "" }
      ],
      "impact": "",
      "fix": "",
      "execution_steps": [],
      "validation": "",
      "guardrail": {
        "enforceable": true,
        "layer": "lint-meta|eslint-plugin|none",
        "rule": "<existing rule to extend, or proposed new rule name>",
        "note": "why this class can (or cannot) be a static check"
      }
    }
  ],
  "execution_plan": [
    {
      "order": 1,
      "finding_id": "F001",
      "why_now": "",
      "files_to_change": [],
      "commands_to_run": []
    }
  ],
  "quick_wins": [],
  "blocked_or_uncertain": [
    { "topic": "", "missing_evidence": "", "how_to_verify": "" }
  ]
}
```

## What counts as a real finding here (calibration)

Anchor severity to this repo's merge bar (`AGENT_CONTRACT.md`): no `any`/`as`/`!`, no
inline `eslint-disable`, one concern per file, `ApiErrors.*` not `new Error`, structured
logging with `event:`, audit-log on mutations, multi-tenant `accountId` scoping,
Stripe signature verification, Valkey-backed OAuth state, `httpOnly`+`secure` cookies.

- **critical/high**: security (PII/body leakage, missing auth/ability checks, secret
  exposure), data-loss/race conditions, broken CI gates, build that ships dev-only code
  to prod. Must cite the exact vulnerable line.
- **medium**: missing tests on `*.{service,routes,jobs,check,utils}.ts` siblings,
  dependency drift across apps, perf (bundle size, N+1), DX gaps.
- **low**: code_quality nits with a clear mechanical fix.

Do NOT report: style the formatter/ESLint already enforces, anything without a file,
or "consider adding X" advice with no concrete defect.

## Red flags — you are doing it wrong if
- A finding is a class a linter/parser could catch but you left `guardrail.enforceable`
  unset or didn't name the rule to add/extend.
- You wrote prose explanation in chat instead of the JSON file.
- A finding has no `file`. (→ `blocked_or_uncertain`.)
- You ran the audit single-threaded when the repo is large. (→ fan out.)
- `validation` is a made-up command not in any `package.json`/`scripts/`.
- You edited a source file. (Audit is read-only.)
