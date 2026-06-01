#!/usr/bin/env bash
# Root-level pre-push fan-out for the monorepo.
#
# Each app (apps/api, apps/ui) ships its own husky pre-push gate that
# mirrors its CI workflow. Those hooks live inside the apps' own
# .husky directories and are wired into the per-app `prepare` scripts.
# Since `git push` from the repo root uses `.git/hooks/pre-push` (which
# husky does NOT install at the root for a monorepo), pushes from the
# root would otherwise bypass every gate. This script is the root
# hook that runs the right app gate(s) based on what is being pushed.
#
# What counts as "this app changed":
#   - Any staged or unpushed commit touches `apps/<app>/` paths.
#   - The workflow file under .github/workflows/apps-<app>-*.yml.
#   - The root codecov.yml (affects upload behaviour for every app).
#
# Bypass: `git push --no-verify` (use sparingly, breaks the build).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="$(cd "$ROOT/.." && pwd)"
cd "$ROOT"

c_red()    { printf '\033[1;31m%s\033[0m\n' "$*"; }
c_green()  { printf '\033[1;32m%s\033[0m\n' "$*"; }
c_blue()   { printf '\033[1;34m%s\033[0m\n' "$*"; }
c_yellow() { printf '\033[1;33m%s\033[0m\n' "$*"; }

step() { printf '\n'; c_blue "▶ $*"; }
fail() { c_red "✗ $*"; exit 1; }
ok()   { c_green "✓ $*"; }
warn() { c_yellow "! $*"; }

# Resolve the range of commits about to be pushed. Husky forwards the
# git push hook stdin to the script, but here we run as a wrapper so we
# inspect the working set against the upstream main branch instead.
UPSTREAM="${UPSTREAM:-origin/main}"

if ! git rev-parse --verify "$UPSTREAM" >/dev/null 2>&1; then
  warn "Upstream $UPSTREAM not found — running all app gates."
  CHANGED_PATHS=""
else
  CHANGED_PATHS="$(git diff --name-only "$UPSTREAM"...HEAD)"
fi

app_changed() {
  local app="$1"
  if [[ -z "$CHANGED_PATHS" ]]; then
    return 0
  fi
  if echo "$CHANGED_PATHS" | grep -qE "(^apps/${app}/|^\.github/workflows/apps-${app}-|^codecov\.yml$)"; then
    return 0
  fi
  return 1
}

run_app_gate() {
  local app="$1"
  local husky="apps/${app}/.husky/pre-push"
  local fallback="apps/${app}/scripts/pre-push.sh"

  # Husky's user-script convention installs the per-app `pre-push` at
  # rw-r--r-- and runs it via `. /path/to/h`. Detecting it as `-x`
  # would miss every husky-managed gate; just check existence and run
  # under bash so the permission bit doesn't matter.
  if [[ -f "$husky" ]]; then
    step "Running ${app} pre-push gate (husky)"
    ( cd "apps/${app}" && bash "./.husky/pre-push" )
    ok "${app} gate passed"
    return 0
  fi

  if [[ -f "$fallback" ]]; then
    step "Running ${app} pre-push gate (scripts)"
    ( cd "apps/${app}" && bash "./scripts/pre-push.sh" )
    ok "${app} gate passed"
    return 0
  fi

  warn "Skipping ${app} — no pre-push script at ${husky} or ${fallback}."
}

step "Root pre-push fan-out"

if [[ -z "$CHANGED_PATHS" ]]; then
  c_yellow "  No upstream baseline — running every app gate."
else
  c_blue "  Changed files vs ${UPSTREAM}:"
  echo "$CHANGED_PATHS" | sed 's/^/    /'
fi

# Security scanners run first — gitleaks, semgrep, osv-scanner all
# fail the entire push, so racing them ahead of the slower per-app
# `validate` saves time when a finding lands here.
bash "$ROOT/scripts/ci/pre-push-security.sh"

# Smoke + Playwright runs next, before the per-app validate fan-out.
# Path-gated: short-circuits to a no-op when nothing in api/auth,
# lib/crypto, compose, or the UI auth surface changed. When it does
# fire, it reuses any already-running dev stack instead of demolishing
# it; otherwise it boots STACK=smoke and tears it back down on exit.
bash "$ROOT/scripts/ci/pre-push-smoke.sh"

RAN_ANY=0

for app in api ui docs; do
  if app_changed "$app"; then
    run_app_gate "$app"
    RAN_ANY=1
  fi
done

if [[ "$RAN_ANY" -eq 0 ]]; then
  ok "No app-scoped changes — root pre-push has nothing to gate."
fi

ok "Root pre-push fan-out finished"
