---
name: audit-ci-workflows
description: Use when an agent needs a focused, machine-consumable audit of .github/workflows and infra — action SHA pinning, push/PR path-filter parity, least-privilege permissions, secret handling, concurrency, version-pin drift, and local-vs-CI gate parity. Read-only; emits one JSON artifact a follow-up coding agent can execute. Triggers — "audit CI workflows", "audit github actions", "check action SHA pinning", "review workflow permissions/secrets", "audit CI parity", "audit-ci-workflows".
---

# Audit ci workflows (agent-to-agent)

You are producing a **CI/workflow + infra-pipeline** audit **for another AI agent to
execute** (the `execute-audit` skill). Optimize for token efficiency and machine
consumption. Output is a single JSON file. Stay in the CI/pipeline lane — app code belongs
to other scoped audits.

## Iron rules

1. **Read-only.** No edits except the one artifact. No workflow runs. Static analysis only:
   read YAML/scripts + targeted `grep`/`rg`.
2. **Evidence or it doesn't ship.** Every finding cites exact `file` + `lines_or_symbol`.
   No path → `blocked_or_uncertain`.
3. **Precision over volume.** Verify intent before flagging — this repo deliberately leaves
   some `pull_request` triggers UNFILTERED so branch protection always gets a required
   status, and gates the expensive steps with an in-job `dorny/paths-filter`. A missing
   trigger-level `paths` is NOT a defect when an in-job filter gate exists. Read the whole
   workflow before concluding.
4. **No prose outside JSON.** Only chat output: artifact path + one-line count.
5. **Rank for an autonomous agent** (safe-first) in `execution_plan`.
6. **Guardrail-first.** Many classes here ALREADY have lint-meta rules in
   `apps/api/scripts/lint-meta/rules/ci/` — check before proposing new ones:
   `github-actions-runner-pinned`, `github-actions-service-image-digest-pin`,
   `github-actions-permissions`, `github-actions-timeout-required`,
   `github-actions-concurrency-explicit`, `github-actions-security-no-cancel`
   (security workflows intentionally use `cancel-in-progress: false`),
   `github-actions-paths-filter-parity` (push.paths ↔ in-job dorny filter),
   `github-actions-expression-syntax`, `github-actions-pip-install-pinned`,
   `engine-pin-parity` (bun version across pkg/Docker/workflows),
   `security-scanner-version-parity`, `pre-push-ci-parity`, `dockerfile-base-image-sha-pin`,
   `tofu-bootstrap-hardening`. If a finding is a class one of these CLAIMS to cover but it
   slipped, the gap IS the finding — name the rule and the gap in `guardrail.note`.

## Scope (read only these)

- `.github/workflows/**` (all 24: per-app ci/validate/release, `*-security-deps`,
  `*-security-sast`, `*-security-secrets`, drift checks, bundle-diff, linkcheck, compose
  smoke + playwright e2e)
- `scripts/ci/**`, `scripts/stack-*.sh`, `scripts/ci/pre-push*.{sh,json}` (local gate)
- `infra/**` (compose files, bootstrap/OpenTofu) — pipeline/security aspects only
- root `package.json` engines/packageManager (the version source of truth)

## What to hunt (CI calibration for THIS repo)

- **critical** — a secret printed/echoed or written to logs; a workflow with broad
  `permissions: write-all` on a code path that runs untrusted PR code; `pull_request_target`
  misuse (checks out + runs PR code with secrets); an action referenced by mutable tag where
  a compromised tag would run in a privileged context.
- **high** — third-party action pinned to a tag/branch, not a full commit SHA (supply
  chain); a required gate that runs LOCALLY in `pre-push` but is MISSING from GitHub CI (or
  vice versa) — the repo cares deeply about local↔CI parity (`pre-push-ci-parity`); version
  drift between a workflow tool pin and its source of truth (bun, gitleaks, trivy, semgrep);
  service container image pinned by tag not digest.
- **medium** — missing least-privilege `permissions:` block (defaults to broad); missing
  `timeout-minutes` (runaway jobs); missing/incorrect `concurrency` group; a security SARIF
  upload that could mask a real scan failure (verify: a `continue-on-error` upload paired
  with `if: always()` AFTER a scan that already gates via `exit-code:1` is the
  GitHub-recommended pattern, NOT a defect); path-filter drift where push.paths and the
  in-job dorny filter genuinely diverge.
- **low** — inconsistent action versions across workflows; cache key gaps; documentation/
  comment drift on a security-relevant step.

For EACH finding name the existing lint-meta rule it belongs to (and whether the rule has a
gap), or propose a new `ci`-category rule. Prefer closing a rule gap over a one-off edit.

Do NOT report: app logic, style, or a "missing paths filter" that is actually covered by an
in-job filter gate (verify first). Do NOT suggest flipping compose `api.prod.env`
`required:false` → `true` (load-bearing for prod config rendering).

## Process

### 1. Map (cheap, inline)
List `.github/workflows/`. Read `scripts/ci/pre-push.manifest.json` (the source of truth for
which gates must run) and 2-3 representative workflows (one per-app ci, one `*-security-*`,
one compose) to learn the pinning/permissions/concurrency conventions. Skim the existing
`ci`-category lint-meta rules so you know what's already enforced.

### 2. Fan out (parallel subagents — one Agent call per cell, single message)
| Cell | Scope | Focus |
| ---- | ----- | ----- |
| pinning-supply-chain | all workflows + Dockerfiles | action SHA pins, service image digests, tool version pins vs source of truth |
| permissions-secrets | all workflows | least-privilege permissions, secret handling, pull_request_target, untrusted-code risk |
| parity-gates | workflows + `scripts/ci/pre-push*`, `scripts/stack-*.sh` | local↔CI gate parity, path-filter parity (verify in-job filters), concurrency/timeout |

Orders verbatim: *read-only; cite exact file + line; READ THE WHOLE WORKFLOW before
concluding a gate is missing (check for in-job dorny/paths-filter and exit-code gating);
map each finding to an existing ci lint-meta rule (gap) or a proposed one; return a JSON
array ONLY; weak/uncertain → `blocked`; CI lane only.*

### 3. Merge + rank
Dedupe by file+step. IDs `F001`… by severity then effort. `validation` = a real command:
`cd apps/api && bun run lint:meta` (for rule-backed findings), a targeted `grep`/YAML
assertion, or `cd apps/api && bun run check`. Never invent a command. `quick_wins` =
`effort:"S"` and severity ≥ medium.

### 4. Emit
Write to `.audit/ci-workflows/audit-report.json` (create dir; gitignored — per-domain path
so concurrent scoped audits don't clobber). Print ONLY path + counts, e.g.
`Wrote .audit/ci-workflows/audit-report.json — 5 findings (2 high), 2 quick wins, 1 blocked.`

## Output schema (valid JSON, identical to audit-monorepo so execute-audit consumes it)

```json
{
  "repo_map": { "apps": [], "build_system": "", "test_system": "", "ci": [], "critical_paths": [] },
  "domain": "ci-workflows",
  "findings": [
    {
      "id": "F001",
      "severity": "critical|high|medium|low",
      "effort": "S|M|L",
      "category": "security|reliability|build",
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
- You flagged a "missing PR paths filter" without checking for an in-job dorny/paths-filter gate.
- You flagged a `continue-on-error` SARIF upload that is the recommended `if: always()` pattern.
- A finding maps to an existing ci lint-meta rule but you didn't name the rule/gap.
- You suggested flipping compose `api.prod.env` `required:false`.
- You skipped fan-out or wrote prose in chat instead of the JSON file.
