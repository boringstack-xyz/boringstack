#!/usr/bin/env bash
# Security pre-push gate. Closes the parity hole between the local
# `bun run validate` and the GitHub Actions security-* workflows. Runs
# the same scanners CI runs, with the same configs, against the same
# files — so anything that would red-flag in CI red-flags on the dev
# machine before the push leaves.
#
# Three scanners:
#
#   1. gitleaks (.gitleaks.toml)           — secret-shaped strings in
#      any commit on this branch, anywhere in the tree.
#   2. semgrep  (.semgrep/<app>.yml + p/*) — SAST against changed apps
#      only (running on every push is too slow; path-scoping mirrors
#      the CI dorny/paths-filter step).
#   3. osv-scanner (osv-scanner.toml)      — dependency vulns against
#      apps/<app>/bun.lock when the lockfile changed.
#
# Hard fail on missing tools. Silent skip is exactly how the last two
# CI breakages slipped through; "install gitleaks" / "install semgrep"
# is one Homebrew formula away on a Mac and one apt command on Linux.
#
# Bypass: `git push --no-verify`.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="$(cd "$ROOT/.." && pwd)"
cd "$ROOT"

c_red()    { printf '\033[1;31m%s\033[0m\n' "$*"; }
c_green()  { printf '\033[1;32m%s\033[0m\n' "$*"; }
c_blue()   { printf '\033[1;34m%s\033[0m\n' "$*"; }

step() { printf '\n'; c_blue "▶ $*"; }
fail() { c_red   "✗ $*"; exit 1; }
ok()   { c_green "✓ $*"; }

UPSTREAM="${UPSTREAM:-origin/main}"

if git rev-parse --verify "$UPSTREAM" >/dev/null 2>&1; then
  CHANGED_PATHS="$(git diff --name-only "$UPSTREAM"...HEAD)"
else
  CHANGED_PATHS=""
fi

paths_match() {
  local pattern="$1"
  if [[ -z "$CHANGED_PATHS" ]]; then
    return 0
  fi
  echo "$CHANGED_PATHS" | grep -qE "$pattern"
}

# ─── 1. gitleaks ───────────────────────────────────────────────────────────
step "Security 1/3 — gitleaks (secret scan)"

if ! command -v gitleaks >/dev/null 2>&1; then
  fail "gitleaks not installed. Install with: brew install gitleaks  (or see https://github.com/gitleaks/gitleaks#installing)"
fi

# Parity warning: CI pins a specific gitleaks version (its ruleset). A local
# version that drifts can miss a leak CI would catch (or vice versa), so the
# scan only matches CI when versions match. Read the pin straight from the
# workflow so this never goes stale against a CI bump.
GITLEAKS_WORKFLOW=".github/workflows/apps-api-security-secrets.yml"
EXPECTED_GITLEAKS_VERSION="$(grep -m1 'GITLEAKS_VERSION:' "$GITLEAKS_WORKFLOW" 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || true)"
LOCAL_GITLEAKS_VERSION="$(gitleaks version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)"
if [[ -n "$EXPECTED_GITLEAKS_VERSION" && "$LOCAL_GITLEAKS_VERSION" != "$EXPECTED_GITLEAKS_VERSION" ]]; then
  c_red "  ⚠ local gitleaks ${LOCAL_GITLEAKS_VERSION:-unknown} != CI-pinned ${EXPECTED_GITLEAKS_VERSION} — ruleset may differ from CI. Install the pinned version to guarantee parity: https://github.com/gitleaks/gitleaks/releases/tag/v${EXPECTED_GITLEAKS_VERSION}"
fi

gitleaks detect \
  --source . \
  --config .gitleaks.toml \
  --no-banner \
  --redact \
  --exit-code 1 \
  --report-format sarif \
  --report-path /tmp/gitleaks-pre-push.sarif \
  || fail "gitleaks found leaked secrets. Inspect the output above and fix or add a narrow allowlist entry to .gitleaks.toml."
ok "gitleaks clean"

# ─── 2. semgrep ────────────────────────────────────────────────────────────
# Matches the two security-sast workflows: apps-api-security-sast.yml +
# apps-ui-security-sast.yml. Configs are kept in lockstep with those
# files — if you change a --config flag in either workflow, mirror it
# here too.

run_semgrep_for_app() {
  local app="$1"
  shift
  local configs=("$@")

  if ! command -v semgrep >/dev/null 2>&1; then
    fail "semgrep not installed. Install with: brew install semgrep  (or: pip install semgrep)"
  fi

  step "Security 2/3 — semgrep (${app})"
  ( cd "apps/${app}" && semgrep scan "${configs[@]}" --error --quiet )
  ok "semgrep clean for ${app}"
}

API_TOUCHED=0
UI_TOUCHED=0

if paths_match '(^apps/api/(src|scripts)/|^\.github/workflows/apps-api-security-sast\.yml$|^\.semgrep/api\.yml$)'; then
  API_TOUCHED=1
fi

if paths_match '(^apps/ui/(src|scripts)/|^\.github/workflows/apps-ui-security-sast\.yml$|^\.semgrep/ui\.yml$)'; then
  UI_TOUCHED=1
fi

if [[ $API_TOUCHED -eq 1 ]]; then
  run_semgrep_for_app api \
    --config=p/owasp-top-ten \
    --config=p/javascript \
    --config=p/typescript \
    --config=p/nodejs \
    --config=.semgrep/api.yml
else
  c_blue "  api: no source changes, skipping semgrep"
fi

if [[ $UI_TOUCHED -eq 1 ]]; then
  run_semgrep_for_app ui \
    --config=p/owasp-top-ten \
    --config=p/javascript \
    --config=p/typescript \
    --config=p/react \
    --config=.semgrep/ui.yml
else
  c_blue "  ui: no source changes, skipping semgrep"
fi

# ─── 3. osv-scanner ────────────────────────────────────────────────────────
# Matches apps-{api,ui,docs}-security-deps.yml. Only runs against the
# apps whose bun.lock actually changed — repeating a clean scan adds
# nothing.

run_osv_for_app() {
  local app="$1"

  if ! command -v osv-scanner >/dev/null 2>&1; then
    fail "osv-scanner not installed. Install with: brew install osv-scanner  (or see https://google.github.io/osv-scanner/installation/)"
  fi

  step "Security 3/3 — osv-scanner (${app})"
  osv-scanner \
    --config="apps/${app}/osv-scanner.toml" \
    --lockfile="apps/${app}/bun.lock" \
    || fail "osv-scanner found vulnerable dependencies in apps/${app}. Upgrade the flagged package(s) or add a temporary entry to apps/${app}/osv-scanner.toml with a tracking issue."
  ok "osv-scanner clean for ${app}"
}

for app in api ui docs; do
  if paths_match "^apps/${app}/bun\\.lock$|^apps/${app}/osv-scanner\\.toml$"; then
    run_osv_for_app "$app"
  fi
done

printf '\n'
ok "Security pre-push gate passed"
