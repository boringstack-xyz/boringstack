---
name: execute-audit
description: Use when a machine-readable audit produced by the audit-monorepo skill exists and should be fixed autonomously — finds `.audit/audit-report.json`, then works every finding to completion on one branch, validating each with the repo's own checks. Read-and-fix; it edits code. Triggers — "execute the audit", "run the audit report", "fix the audit findings", "apply the audit", "work the audit", "fix everything in the audit", "execute audit-report.json", "remediate the audit".
---

# Execute audit (autonomous remediation)

You are executing the findings in an audit report **to completion, without
stopping to ask**. The report was produced by the `audit-monorepo` skill. Your job
is to fix every finding, validate each fix with this repo's own checks, and land
the work on a single branch.

## North star (decides every judgment call)

This repo aims to be **the most production-ready open starter on the internet**.
When a finding offers options or the fix is ambiguous, choose the path that best
serves, in order: **security → defense-in-depth / defensive programming →
genericness (works for any consumer of the template, no app-specific assumptions) →
developer experience**. Never pick the lazy option; pick the one a senior engineer
shipping a flagship template would. Record the choice in the run log.

## Guardrail-first remediation (lint as a contract)

This stack's core value is **lint as a contract**: defects are _prevented by linters and
parsers_, not caught by review. So before fixing a finding, ask: **is this a _class_ of
defect a static check could catch — not a one-off logic bug?** If yes, the fix is not the
code change alone; it is **the guardrail plus the code change**, in this order:

1. **Find or create the rule.** Two layers:
   - **lint-meta** (in-repo; repo-level drift: version/SHA pins, CI parity, env cascade,
     source-text bans, test-sibling coverage, config). Add or extend an `IMetaRule` under
     `apps/<app>/scripts/lint-meta/rules/<category>/` and register it in `registry.ts`.
     This is the default — it lives in this repo and you can edit it.
   - **ESLint custom plugins** (`@boring-stack-pkg/eslint-plugin-*`; architecture _inside_
     TypeScript modules). Source is cross-repo (`boringstack-xyz/eslint-plugins`) and
     usually not editable from here — if the class fits, express it as a lint-meta
     source-text rule instead; otherwise flag it for that repo in the run log.
2. **Surface the bug through the rule (RED).** Run `bun run lint:meta` (or `bun run check`)
   and confirm the finding's exact instances now fail as violations. If the rule doesn't
   flag them, the rule is wrong — fix the rule first. A guardrail that misses the known
   case is worthless.
3. **Fix the code until the rule passes (GREEN).** The command that surfaced the bug now
   proves it's gone.
4. **Lock it in.** Add/extend a test under `apps/<app>/tests/lint-meta/`, run
   `bun run generate:lint-meta-docs` to refresh `RULES.md`, and commit rule + test + fix
   together. The rule now blocks this defect for every future consumer of the template.

**An existing rule with a gap still counts.** If a finding is a class a guardrail _claims_
to cover but slipped through (e.g. actions that should be SHA-pinned with no rule enforcing
it, or a rule that misses a syntax variant), the real bug is the gap: close the rule, watch
the instances surface, then fix.

**When NOT to add a rule:** genuinely one-off logic bugs, data-specific issues, or anything
not expressible as a static check — fix those directly. When unsure, lean toward the rule;
extending the tooling is the higher-leverage outcome for this stack.

## Completion discipline

Finish every finding. Do not stop early, do not batch-ask for confirmation, do not
leave findings silently unaddressed. The ONLY acceptable non-done states are:

- **failed** — the fix could not pass checks after 2 repair attempts → revert it.
- **skipped** — only items already in the report's `blocked_or_uncertain` (they need
  external evidence, not a code fix).

Report both at the end. Everything in `findings[]` is otherwise mandatory.

## Process

### 1. Locate the report
Look for `.audit/audit-report.json`. If absent, also `find . -name 'audit-report.json' -not -path '*/node_modules/*'`.
- **None found** → stop. Tell the user to run `/audit-monorepo` first. Do nothing else.
- **Found** → load it. (Ignore any `*.done.json`; those are already executed.)

### 2. Preflight (once)
- Confirm `.audit/` is gitignored; if not, add it (do not commit the report).
- If on the default branch (`main`), create ONE branch for the whole run:
  `git checkout -b chore/audit-fixes-$(date +%Y%m%d-%H%M)`. If already on a non-main
  feature branch, stay on it. All findings land on this single branch.
- Create a TodoWrite item per finding so progress is visible.

### 3. Build the work queue
Order = the report's `execution_plan` (it is ranked safe-first / unblock-first), then
append any `findings[]` not referenced there, sorted by severity then effort. Process
**sequentially** — findings frequently share files (CI YAML, `package.json`) and later
steps assume earlier ones landed. Do not parallelize unless two findings are provably
disjoint in files.

### 4. Per finding (the loop)
1. Mark the todo in_progress.
2. **Classify, then fix.** Apply **Guardrail-first remediation** (above): if the finding is
   a class a linter/parser can enforce, add or extend the rule, surface the bug through it,
   then fix the code. Otherwise apply the fix directly from `fix` + `execution_steps`.
   Either way honor the repo merge bar from `apps/api/AGENT_CONTRACT.md` (no `any`/`as`/`!`,
   no inline `eslint-disable`, `ApiErrors.*` not `new Error`, structured logging with
   `event:`). For judgment calls, apply the **North star**.
3. Validate: run the finding's `validation` command (plus `bun run lint:meta` for any rule
   you added/extended), AND the fast Docker-free gate in every app you touched —
   `cd apps/api && bun run check`, `cd apps/ui && bun run check`,
   `cd apps/docs && bun run check:docs-data` (docs has no `check` script). Heavy
   `validate`/tests/e2e run at push time via the pre-push hook.
4. **Green** → commit just this finding's files with a conventional message, e.g.
   `fix(<scope>): <finding title>` and a trailer `Audit: <finding id>`. Mark todo done.
   **Red** → make up to 2 repair attempts. Still red → `git restore`/`git checkout --`
   the finding's files (revert to last commit), mark **failed**, continue. Never commit
   red code.

### 5. Finish
- Run `bun run check` once more in each touched app to confirm the cumulative state is green.
- Push the branch: `git push -u origin <branch>` (pre-push runs the full security/smoke
  gate — that is the real validation; if it blocks, fix the cause and re-push).
- Rename the consumed report to `.audit/audit-report.$(date +%Y%m%d-%H%M).done.json` so a
  re-run won't reprocess it, and write `.audit/execution-summary.json`:
  `{ "branch": "...", "done": ["F001", ...], "failed": [{"id":"","why":""}], "skipped": ["..."], "decisions": [{"id":"","chose":"","why":""}] }`.
- Print a one-screen summary: branch name, counts (done/failed/skipped), and any failed
  findings with their reason. Offer to open a PR (`gh pr create`); do not open it unasked.

## Quick reference

| Step | Command |
| ---- | ------- |
| find report | `cat .audit/audit-report.json` |
| branch | `git checkout -b chore/audit-fixes-$(date +%Y%m%d-%H%M)` |
| per-app gate | `cd apps/api && bun run check` · `cd apps/ui && bun run check` · `cd apps/docs && bun run check:docs-data` |
| revert a finding | `git checkout -- <files>` (uncommitted) |
| commit | `git commit -m "fix(<scope>): <title>" -m "Audit: <id>"` |
| push (full gate) | `git push -u origin <branch>` |

## Red flags — you are doing it wrong if
- You patched a class-of-defect finding with a one-off code change when a lint-meta rule
  could enforce it — extend the guardrail first, then fix (lint as a contract).
- You wrote a rule that doesn't actually flag the finding's known instances.
- You asked the user to confirm mid-run instead of deciding via the North star.
- You committed code that fails `bun run check`.
- You stopped after the `execution_plan` items and ignored the rest of `findings[]`.
- One failing fix halted the whole run (it should revert + continue).
- You re-ran a report already renamed `*.done.json`.
- You edited `blocked_or_uncertain` items blind (they need evidence, not a fix).
