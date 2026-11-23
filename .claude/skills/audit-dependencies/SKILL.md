---
name: audit-dependencies
description: Use when an agent needs a focused, machine-consumable audit of dependencies across apps — cross-app version drift, override hygiene, exact-pin policy, lockfile integrity, unused/missing deps (knip), and supply-chain/vuln-override posture. Read-only; emits one JSON artifact a follow-up coding agent can execute. Triggers — "audit dependencies", "check dependency drift", "audit package.json across apps", "review overrides / pins", "audit supply chain", "audit-dependencies".
---

# Audit dependencies (agent-to-agent)

You are producing a **dependency/supply-chain** audit across all apps **for another AI agent
to execute** (the `execute-audit` skill). Optimize for token efficiency and machine
consumption. Output is a single JSON file. Stay in the dependency lane — runtime code belongs
to other scoped audits.

## Iron rules

1. **Read-only.** No edits except the one artifact. No installs/builds. Static analysis only:
   read `package.json`/lockfiles/configs + targeted `grep`/`rg`. `knip`/`bun pm ls`/
   `bun outdated` read-only ONLY if you cite exact output (never as a substitute for reading).
2. **Evidence or it doesn't ship.** A drift finding cites BOTH versions and BOTH files. An
   unused-dep finding cites the tool output AND confirms by grepping for real usage (knip
   has false positives on dynamic `import()` and `ignoreExportsUsedInFile`). No path →
   `blocked_or_uncertain`.
3. **Precision over volume.** Real drift / real vuln / real lockfile break beats "bump X to
   latest". Do not propose version bumps without a concrete reason (CVE, drift, dedupe break).
4. **No prose outside JSON.** Only chat output: artifact path + one-line count.
5. **Rank for an autonomous agent** (safe-first) in `execution_plan`.
6. **Guardrail-first.** These classes ALREADY have lint-meta rules — check before proposing
   new ones: `package-json-exact-deps` (no `^`/`~` ranges), `shared-tool-version-parity`
   (eslint/prettier/typescript/knip/husky aligned across apps), `package-override-parity`,
   `no-overlapping-libs`, `engine-pin-parity`, `security-scanner-version-parity`,
   `eslint-plugin-contract-parity`. If a drift slipped a rule that claims the class, the gap
   IS the finding.

## Scope (read only these)

- `apps/api/package.json`, `apps/ui/package.json`, `apps/docs/package.json`, root `package.json`
- per-app `bun.lock` (this repo uses PER-APP lockfiles; root `bun.lock` is untracked) — check
  for drift vs `package.json` (a `package.json` dep with no matching lockfile entry breaks the
  frozen install in CI)
- `apps/*/knip.json` (unused/missing detection config), `apps/*/.size-limit.json`,
  `osv-scanner.toml` / security-deps allowlists, Dependabot config (`.github/dependabot.yml`)
- `apps/api/scripts/lint-meta/rules/supply-chain/**` (existing dep guardrails)

## What to hunt (dependency calibration for THIS repo)

- **critical** — a known-vulnerable version pinned directly with no override/justification; a
  secret/token committed in a config; a lockfile that doesn't satisfy `package.json` (frozen
  install would fail CITY-wide — the repo's documented failure mode).
- **high** — the SAME dependency pinned to DIFFERENT versions across api/ui/docs (drift →
  divergent behavior / double-bundling); a shared tool (eslint, prettier, typescript,
  typescript-eslint, knip, husky) out of parity across apps (should be caught by
  `shared-tool-version-parity` — flag the gap if not); an override in one app missing where a
  sibling needs the same security override AND the vulnerable version is actually in that
  app's tree (verify with `bun pm ls`; do NOT propose adding overrides for packages absent
  from the tree — that's noise).
- **medium** — caret/tilde range where the repo policy is exact pins (`package-json-exact-deps`
  gap); a genuinely unused dependency confirmed by knip AND grep (not a dynamic-import/
  `ignoreExportsUsedInFile` false positive); a missing dependency used in code but only present
  transitively; Dependabot dedupe trap on a known-fragile pair (ioredis via bullmq,
  @astrojs/markdown-remark via astro — only report if NEW/changed).
- **low** — stale `overrides`/`ignoreDependencies` entries that no longer match anything;
  size-limit budget with no entry for a new heavy dep.

KNOWN, do-not-re-report unless changed: ioredis (via bullmq) and @astrojs/markdown-remark
(via astro) dedupe traps; SUPERUSER_* env vars are read by `scripts/seed/migrate`, not just
`src/` — grep wide before calling an env-driven dep unused.

Do NOT report: "upgrade to latest" with no concrete driver, transitive deps you can't tie to
a real risk, or knip output you didn't cross-check against actual usage.

## Process

### 1. Map (cheap, inline)
Read all four `package.json` files side by side and the existing `supply-chain` lint-meta
rules so you know what parity/pin policy is already enforced. Note each app's lockfile path.

### 2. Fan out (parallel subagents — one Agent call per cell, single message)
| Cell | Scope | Focus |
| ---- | ----- | ----- |
| cross-app-parity | all `package.json` + supply-chain rules | same-dep version drift, shared-tool parity, exact-pin policy, override parity (verify tree presence) |
| lockfile-knip | per-app `bun.lock` + `package.json` + `knip.json` | lockfile↔package.json drift (frozen-install break), unused/missing deps (cross-checked, not raw knip) |
| vuln-supply-chain | `osv-scanner.toml`, security-deps allowlists, Dependabot config, overrides | vulnerable pins, allowlist expiry, dedupe traps, secret-in-config |

Orders verbatim: *read-only; a drift finding cites both versions + both files; an unused-dep
finding cites tool output AND a grep confirming non-use; verify overrides against the actual
tree (`bun pm ls`) before recommending parity; map each finding to an existing supply-chain
lint-meta rule (gap) or a proposed one; return a JSON array ONLY; weak/unverified → `blocked`;
dependency lane only.*

### 3. Merge + rank
Dedupe by package name. IDs `F001`… by severity then effort. `validation` = a real command:
`cd apps/<app> && bun install --frozen-lockfile` (lockfile integrity),
`cd apps/api && bun run lint:meta` (parity/pin rules), `cd apps/<app> && bun run knip`, or a
targeted `grep`/file assertion. NOTE the repo rule: any `package.json` dep change must commit a
refreshed per-app `bun.lock` (put that in `execution_steps`). `quick_wins` = `effort:"S"` and
severity ≥ medium.

### 4. Emit
Write to `.audit/dependencies/audit-report.json` (create dir; gitignored — per-domain path so
concurrent scoped audits don't clobber). Print ONLY path + counts, e.g.
`Wrote .audit/dependencies/audit-report.json — 5 findings (1 high), 2 quick wins, 2 blocked.`

## Output schema (valid JSON, identical to audit-monorepo so execute-audit consumes it)

```json
{
  "repo_map": { "apps": [], "build_system": "", "test_system": "", "ci": [], "critical_paths": [] },
  "domain": "dependencies",
  "findings": [
    {
      "id": "F001",
      "severity": "critical|high|medium|low",
      "effort": "S|M|L",
      "category": "dependencies|security|build",
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
- A drift finding cites one version/file instead of both.
- You proposed adding a security override for a package NOT in that app's tree.
- You trusted raw knip output without grepping to confirm real non-use (dynamic-import false positives).
- You re-reported the known ioredis / @astrojs/markdown-remark dedupe traps without a change.
- You skipped fan-out or wrote prose in chat instead of the JSON file.
