---
name: audit-api-security
description: Use when an agent needs a focused, machine-consumable security audit of apps/api — auth/OAuth/session, multi-tenant accountId scoping, audit-log on mutations, Stripe webhook verification, cookies, rate limiting, secret/PII leakage. Read-only; emits one JSON artifact a follow-up coding agent can execute. Triggers — "audit api security", "security audit of the api", "check auth/tenancy/scoping", "audit accountId scoping", "review Stripe/webhook security", "find security holes in apps/api", "audit-api-security".
---

# Audit api security (agent-to-agent)

You are producing a **security-only** audit of `apps/api` **for another AI agent to
execute** (the `execute-audit` skill), not for a human to read. Optimize the run for
token efficiency and the output for machine consumption. The output is a single JSON
file. No essays, no praise, no generic advice. Stay in the security lane — perf, style,
and DX belong to other scoped audits.

## Iron rules

1. **Read-only.** Do not edit/create/delete any repo file except the one output artifact.
   No builds/installs/migrations/test runs. Static analysis only: read files + targeted
   `grep`/`rg`/`ls`. You MAY run `eslint`/`knip` read-only if you cite exact output.
2. **Evidence or it doesn't ship.** Every finding cites exact `file` + `lines_or_symbol`
   + the concrete `problem`. No file path → `blocked_or_uncertain`, not `findings`.
3. **Precision over volume.** 8 verified high-leverage findings beat 40 vague ones. A
   security finding without the exact vulnerable line is not a finding.
4. **No prose outside JSON.** Only chat output: the artifact path + a one-line count.
5. **Rank for an autonomous agent** (safe-first, unblock-first) in `execution_plan`.
6. **Guardrail-first (lint as a contract).** For every finding decide whether a static
   check could catch the _class_ and fill `guardrail`:
   - **lint-meta** (in-repo, editable: `apps/api/scripts/lint-meta/rules/<category>/`,
     registered in `registry.ts`) — source-text bans, required-call coverage, config
     drift. Good for "every mutation route must call the audit-log service", "no
     `new Error` in services", "cookies must set httpOnly+secure".
   - **eslint-plugin** (`@boring-stack-pkg/eslint-plugin-*`, cross-repo, usually not
     editable here) — architecture inside TS modules. Note it; if it fits a source-text
     ban, prefer expressing it as a lint-meta rule.
   If a guardrail already _claims_ the class but the finding slipped, that gap IS the
   finding — say so in `guardrail.note`.

## Scope (read only these)

- `apps/api/src/api/auth/**` (login, OAuth, session, JWT, MFA), `apps/api/src/api/users/**`,
  `apps/api/src/api/accounts/**` (invitations, join-requests, ownership-transfers),
  `apps/api/src/api/billing/**`, `apps/api/src/api/webhooks/**`, `apps/api/src/api/admin/**`
- `apps/api/src/middleware/**`, `apps/api/src/boot/**`, `apps/api/src/config/**`,
  `apps/api/src/clients/valkey/**` (OAuth state, rate-limit store)
- `apps/api/SECURITY.md`, `apps/api/AGENT_CONTRACT.md` (the merge bar you anchor to)

## What to hunt (security calibration for THIS repo)

Anchor severity to `AGENT_CONTRACT.md` + `SECURITY.md`. The repo's contract:
`httpOnly`+`secure` cookies, Valkey-backed (read-and-delete) OAuth state, Stripe
signature verification, multi-tenant `accountId` scoping, audit-log on every mutation,
structured logging with `event:` and PII redaction, `ApiErrors.*` not `new Error`.

- **critical** — auth bypass / missing ability check on a route; tenant isolation breach
  (a query or response that returns another account's rows; a route that trusts a
  client-supplied `accountId`/cursor without re-scoping); secret or full-body/PII leakage
  into logs or responses; Stripe webhook handler that does not verify the signature;
  OAuth state not single-use (replayable) or not bound to the session; SQL/`sql.raw`
  built from unsanitized input.
- **high** — missing audit-log on a mutation; cookie missing `httpOnly`/`secure`/
  `sameSite`; JWT revocation fail-open where it should fail-closed; rate limit absent on
  an auth/credential endpoint; IDOR (object fetched by id without ownership check); MFA/
  TOTP without replay protection; enumeration (login/reset reveals account existence);
  unbounded request body or missing Content-Length guard.
- **medium** — error responses leaking internals (stack/SQL); `event:`-less logging on a
  security path; weak randomness for tokens; missing `pull-requests`/least-privilege on a
  security-relevant code path; placeholder-secret detection gaps in boot invariants.
- **low** — defense-in-depth nits with a clear mechanical fix.

For EACH finding ask: could a lint-meta rule enforce the class? (e.g.
`audit-log-on-mutation-routes`, `cookies-must-be-httponly-secure`,
`no-client-supplied-accountId`, `stripe-webhook-must-verify-signature`). Name the rule to
add/extend, or set `enforceable:false` for a genuine one-off logic bug.

Do NOT report: anything ESLint/formatter already enforces, perf/DX (other audits own
those), or "consider adding X" with no concrete vulnerable line.

## Process

### 1. Map (cheap, inline)
Read `AGENT_CONTRACT.md`, `SECURITY.md`, `src/middleware/**` (auth/ability/rate-limit),
and one feature triplet (`*.routes.ts` + `*.service.ts`) to learn the conventions
(how routes assert abilities, how `accountId` is resolved, how `auditLogService` and
`ApiErrors` are called).

### 2. Fan out (parallel subagents — one Agent call per cell, in a single message)
| Cell | Scope | Focus |
| ---- | ----- | ----- |
| auth-session | `src/api/auth/**`, `src/middleware/**` | OAuth state single-use, JWT/session, MFA replay, cookies, rate limit, enumeration |
| tenancy-access | `src/api/accounts/**`, `src/api/users/**`, `src/api/admin/**` | accountId scoping, IDOR/ability checks, ownership transfer races |
| billing-webhooks | `src/api/billing/**`, `src/api/webhooks/**` | Stripe signature verify, idempotency, event trust, secret handling |
| boot-config | `src/boot/**`, `src/config/**`, `src/clients/valkey/**` | boot invariants, placeholder-secret detection, prod safety flags, PII/secret in logs |

Give each subagent: its scope paths, the finding schema below, and these orders verbatim:
*read-only; cite exact file + line/symbol for every finding; set `guardrail` (lint-meta
rule to add/extend, or `enforceable:false`); return a JSON array of finding objects ONLY
(no prose); weak evidence → a `blocked` array instead; security lane only.*

### 3. Merge + rank
Dedupe by file+symbol. Assign IDs `F001`… ordered by severity then effort. Set each
finding's `validation` to a real command: `cd apps/api && bun run check` /
`bun run validate` / `bun test <path>` / `bun run lint:meta`, or a targeted `grep`/file
assertion. Build `execution_plan` safe-first; treat `guardrail.enforceable` findings as
higher leverage at equal severity. `quick_wins` = `effort:"S"` and severity ≥ medium.

### 4. Emit
Write the JSON to `.audit/api-security/audit-report.json` (create the dir; `.audit/` is
gitignored). This per-domain path means running several scoped audits in a row never
clobbers another's report. Print to chat ONLY the path + counts, e.g.
`Wrote .audit/api-security/audit-report.json — 7 findings (1 critical, 3 high), 2 quick wins, 2 blocked.`

## Output schema (file content — valid JSON, identical to audit-monorepo so execute-audit consumes it)

```json
{
  "repo_map": { "apps": [], "build_system": "", "test_system": "", "ci": [], "critical_paths": [] },
  "domain": "api-security",
  "findings": [
    {
      "id": "F001",
      "severity": "critical|high|medium|low",
      "effort": "S|M|L",
      "category": "security|reliability",
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
- A tenancy/auth finding has no exact vulnerable line. (→ `blocked_or_uncertain`.)
- You reported perf, style, or DX (out of lane).
- A class a lint-meta rule could catch has `guardrail.enforceable` unset.
- You wrote prose in chat instead of the JSON file.
- You ran the audit single-threaded instead of fanning out.
- `validation` is a command not in any `package.json`/`scripts/`.
