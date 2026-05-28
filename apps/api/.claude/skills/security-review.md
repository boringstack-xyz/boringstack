---
name: security-review
description: Use when reviewing a branch or PR for security regressions in apps/api. Replays the Layer 1 CI scanners locally (gitleaks, osv-scanner, bun audit), invokes Layer 2 agent skills (differential-review, insecure-defaults, sharp-edges, supply-chain-risk-auditor) in parallel, then runs BoringStack-specific invariants — ACL ability checks on routes, multi-tenant accountId scoping, Stripe webhook signature handling, rate limits on credential routes, audit-log coverage on mutations, idempotent BullMQ jobs. Triggers — "security review", "review for security", "any vulnerabilities in this branch", "audit this PR", "is this safe to merge", "is the auth wired correctly", "did we leave any footguns".
---

# Security review (apps/api)

You are reviewing this branch for security regressions. Work through the
five checkpoints below. Do not skip ahead. Print findings as you go; do not
batch them into a single summary at the end.

The user's pre-1.0 rule applies: delete dead branches, don't add "deprecated"
narration. The codebase rules from AGENT_CONTRACT.md are not optional — flag
any violation as a finding.

## Checkpoint 1 — Scope

Run, in this order:

```bash
git rev-parse --abbrev-ref HEAD
git merge-base HEAD origin/main
git diff --stat $(git merge-base HEAD origin/main)..HEAD
```

State the branch name, the base commit, and the file count + lines changed.
If the diff is empty, abort and tell the user there's nothing to review.

## Checkpoint 2 — Layer 1 replay

Three scanners, one after another. Print findings before moving on.

1. **gitleaks** (secret scan, full git history):

   ```bash
   gitleaks detect --source . --no-banner --redact --verbose
   ```

   Any hit is a stop-the-world finding. If `gitleaks` is not installed,
   call out the gap and continue.

2. **osv-scanner** (dependency CVEs):

   ```bash
   osv-scanner --lockfile=bun.lock
   ```

   Filter to `HIGH` / `CRITICAL`. Note any `MEDIUM` only if the package
   is in a credential or webhook path.

3. **bun audit**:

   ```bash
   bun audit --audit-level=high
   ```

   Same threshold as osv-scanner. If both report the same advisory, dedupe
   in the final report.

## Checkpoint 3 — Layer 2 agent skills (parallel)

Dispatch the four below in parallel with the Agent tool. Pass the diff range
from Checkpoint 1 as the scope.

- `/differential-review` — security-focused diff review
- `/insecure-defaults` — fail-open patterns, hardcoded creds
- `/sharp-edges` — dangerous APIs / footguns
- `/supply-chain-risk-auditor` — npm dep ecosystem audit (if package.json
  changed in the diff)

Collect raw findings. Don't filter yet — that happens in Checkpoint 5.

## Checkpoint 4 — Stack-specific invariants

Walk every file in the diff. For each match, print a finding with file:line.

**Route files** (`src/api/**/*.routes.ts`):

- Every new route handler must call `requireAbility` or
  `requireFreshMembership` before any DB write. The
  `route-must-check-ability` ESLint rule should already enforce this — if
  ESLint passes but the call looks missing, the rule may have a gap.

  ```bash
  rg --type=ts 'app\.(get|post|put|patch|delete)' src/api/ | rg -L 'requireAbility|requireFreshMembership'
  ```

  *Findings*: any route file matched but not paired with an ability check.

**Account-scoped queries** (any query touching tables with `accountId`):

- Every `db.select() / db.update() / db.delete()` against an account-scoped
  table must include `where(eq(<table>.accountId, ctx.accountId))`. The
  `account-scoped-tables-require-where` ESLint rule should catch this —
  cross-check by grepping the diff for table writes without an
  `accountId` predicate.

  ```bash
  git diff $(git merge-base HEAD origin/main)..HEAD -- 'src/**/*.service.ts' | rg -A 3 'db\.(select|update|delete)' | rg -L 'accountId'
  ```

**Stripe webhooks** (`src/api/billing/**`, `src/integrations/stripe/**`):

- Every webhook handler uses `constructEventAsync`, NOT `constructEvent`
  (Bun's SubtleCrypto requires the async variant).
- Signature verification happens BEFORE any DB write — never after.
- No PII (email, name) in audit-log metadata; only resource IDs.

  ```bash
  rg --type=ts 'webhooks\.constructEvent\b' src/  # should be empty — only constructEventAsync
  ```

**Auth + credential routes** (`src/api/auth/**`):

- Every login / signup / token-refresh route has a rate-limit middleware
  attached (`countFailedRequest`, narrow mount per route).
- Failed-credential paths emit `auth.login_failed` with no PII in the
  logged event payload.

**Audit log** (`src/**/*.service.ts`):

- Every mutation calls `auditLog.write` with a non-PII `metadata` object.
- No PII (email, raw IP, full user agent) in the metadata — only IDs and
  enum values.

**BullMQ jobs** (`src/jobs/**`):

- Each new job is idempotent on retry — job key derived from a stable input
  (e.g. `<event_type>:<resource_id>`), never from `crypto.randomUUID()`.
- Failure handlers don't leak credentials into log lines.

## Checkpoint 5 — False-positive gate

For every finding produced in Checkpoints 2–4, dispatch `/fp-check` (Trail
of Bits) with the finding's file:line + 20 lines of context. Drop any
finding the gate marks as false-positive. Keep its line in the report
under a "Suppressed" subheading with a one-line reason.

## Checkpoint 6 — Report

Single markdown table, severity-sorted (`error` > `warning` > `info`):

| Severity | File:Line | Source | Finding | Suggested fix |
| --- | --- | --- | --- | --- |

After the table, three lists:
- **Stop-the-world** (any `error` from Checkpoint 2 — secrets, HIGH/CRITICAL CVE)
- **Must-fix-before-merge** (any `error` from Checkpoints 3–4)
- **Worth-addressing-soon** (any `warning`)

End the report with one of:
- ✓ "No blocking findings. Branch is safe to merge after Layer 1 CI passes."
- ✗ "<N> blocking finding(s). Fix the must-fix-before-merge list before merging."

Do NOT run `git push`, `gh pr ...`, or any state-mutating command. Read-only review.
