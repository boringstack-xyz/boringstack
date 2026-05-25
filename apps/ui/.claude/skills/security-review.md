---
name: security-review
description: Use when reviewing a branch or PR for security regressions in ui-template. Replays the Layer 1 CI scanners locally (gitleaks, osv-scanner, bun audit), invokes Layer 2 agent skills (differential-review, insecure-defaults, sharp-edges, supply-chain-risk-auditor) in parallel, then runs BoringStack-specific UI invariants — no raw fetch outside openapi.ts, no dangerouslySetInnerHTML, no import.meta.env outside src/lib/env/, no localStorage token storage, no JSX-level user-supplied strings without i18n, CSRF + content-type validation on user-data flows. Triggers — "security review", "review for security", "any vulnerabilities in this branch", "audit this PR", "is this safe to merge", "did we leave any XSS holes", "is the auth flow safe".
---

# Security review (ui-template)

You are reviewing this branch for security regressions. Work through the
five checkpoints below. Do not skip ahead. Print findings as you go.

The pre-1.0 rule applies: delete dead branches, don't add "deprecated"
narration. The rules in AGENT_CONTRACT.md are not optional — flag any
violation.

## Checkpoint 1 — Scope

```bash
git rev-parse --abbrev-ref HEAD
git merge-base HEAD origin/main
git diff --stat $(git merge-base HEAD origin/main)..HEAD
```

State branch name, base commit, file count + lines changed. Abort if empty.

## Checkpoint 2 — Layer 1 replay

Three scanners, one after another.

1. **gitleaks**:

   ```bash
   gitleaks detect --source . --no-banner --redact --verbose
   ```

   Any hit is stop-the-world.

2. **osv-scanner**:

   ```bash
   osv-scanner --lockfile=bun.lock
   ```

   `HIGH` / `CRITICAL` only.

3. **bun audit**:

   ```bash
   bun audit --audit-level=high
   ```

   Same threshold. Dedupe vs. osv-scanner in the final report.

## Checkpoint 3 — Layer 2 agent skills (parallel)

Dispatch via Agent tool, in parallel:

- `/differential-review`
- `/insecure-defaults`
- `/sharp-edges`
- `/supply-chain-risk-auditor` (only if package.json changed)

Collect raw findings.

## Checkpoint 4 — Stack-specific invariants

Walk every file in the diff. For each match, print a finding with file:line.

**Raw network calls** — banned outside `src/lib/api/openapi.ts`:

```bash
rg --type=ts --type=tsx '\bfetch\s*\(|XMLHttpRequest' src/ | rg -v 'src/lib/api/openapi\.ts'
```

Use `apiClient.GET/POST/...` — the typed client. Any hit is a finding.

**XSS surface** — banned entirely:

```bash
rg --type=ts --type=tsx 'dangerouslySetInnerHTML|innerHTML\s*=|document\.write' src/
```

Already lint-enforced; this is the backstop.

**Env access** — banned outside `src/lib/env/`:

```bash
rg --type=ts --type=tsx 'import\.meta\.env' src/ | rg -v 'src/lib/env/'
```

The typed `env` export from `@/lib/env` is the only entry point.

**localStorage tokens** — auth tokens must NEVER touch localStorage (XSS
reads them). The api sets HTTP-only cookies; the UI doesn't store tokens.

```bash
rg --type=ts --type=tsx 'localStorage\.setItem\s*\(\s*["\x27](token|accessToken|refreshToken|jwt|bearer)' src/
```

**Hardcoded user-facing strings** — every JSX text node goes through
`t("…")` from `react-i18next`. Already lint-enforced by `i18n-keys`; the
backstop here catches strings the rule misses (e.g. inline in `aria-label`).

```bash
git diff $(git merge-base HEAD origin/main)..HEAD -- 'src/**/*.tsx' | rg '^\+.*(aria-label|title|placeholder)="[A-Z]'
```

A hit where the value is a literal English string (not a `t("…")` call) is
a finding.

**OAuth redirect handling** — any new code touching OAuth callbacks must
validate the `state` parameter against the issued nonce and refuse if it
doesn't match. Look in `src/features/auth/components/OAuthCallbackPage/`.

**Theme + render rules** — no `dark:` Tailwind variants (already lint-meta
enforced); no `<a target="_blank">` without `rel="noopener noreferrer"`.

```bash
rg --type=ts --type=tsx 'target=["\x27]_blank["\x27]' src/ | rg -v 'noopener'
```

## Checkpoint 5 — False-positive gate

For each finding from Checkpoints 2–4, dispatch `/fp-check` with the
finding's file:line + 20 lines of context. Drop false positives; keep their
lines under a "Suppressed" subheading with the gate's reason.

## Checkpoint 6 — Report

Single markdown table, severity-sorted:

| Severity | File:Line | Source | Finding | Suggested fix |
| -------- | --------- | ------ | ------- | ------------- |

Three lists after:

- **Stop-the-world** (secrets, CRITICAL CVE)
- **Must-fix-before-merge** (errors from Checkpoints 3–4)
- **Worth-addressing-soon** (warnings)

End with:

- ✓ "No blocking findings. Branch is safe to merge after Layer 1 CI passes."
- ✗ "<N> blocking finding(s). Fix the must-fix-before-merge list before merging."

Read-only. No `git push`, no `gh pr ...`, no `bun run build` side-effects.
