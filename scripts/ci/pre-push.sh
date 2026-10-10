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
# Fast by default (see "Fast by default" below); `FULL_PREPUSH=1 git push`
# runs every gate as CI does.
# Bypass: `git push --no-verify` (use sparingly, breaks the build).

set -euo pipefail

# Git hooks run with GIT_DIR, GIT_INDEX_FILE and friends pointing at this
# checkout. Fixture tests in the gates below create temporary repositories,
# and inherited values would send their commits and index writes into the real
# repo. Clear them before any step runs.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_PREFIX GIT_COMMON_DIR

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
  if grep -qE "(^apps/${app}/|^\.github/workflows/apps-${app}-|^codecov\.yml$)" <<< "$CHANGED_PATHS"; then
    return 0
  fi
  return 1
}

# infra/compose ships a CI gate (infra-compose-validate-compose.yml) that
# `docker compose config`s every overlay combination + shellchecks + yamllints.
# Its local mirror is infra/compose/scripts/pre-push.sh. Without this, a push
# that only touches infra/compose runs smoke (one dev+smoke boot) but never the
# config matrix: a malformed prod/glitchtip/wud overlay would slip to CI. Gate
# on the same paths the CI workflow triggers on.
infra_compose_changed() {
  if [[ -z "$CHANGED_PATHS" ]]; then
    return 0
  fi
  if grep -qE "(^infra/compose/|^scripts/|^\.github/workflows/infra-compose-)" <<< "$CHANGED_PATHS"; then
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

# ─── Fast by default ─────────────────────────────────────────────────────
# A push runs what fails fastest and most often: the secret scan, each
# changed app's own `check` (lint, lint:meta, format, typecheck, knip, as the
# app defines it), the UI tests touching what this push adds, shared packages
# and the static Compose gate. Full test suites, builds, bundle budgets,
# semgrep, osv-scanner and the smoke/Playwright run stay in the pull
# request's required checks, which block the merge, so they are not paid
# twice per push. The first product built on the template paid them on every
# push and ended up skipping the hook instead.
# FULL_PREPUSH=1 git push runs the whole local gate below.
if [[ "${FULL_PREPUSH:-0}" != "1" ]]; then
  bash "$ROOT/scripts/ci/pre-push-security.sh" --secrets-only

  for app_path in "$ROOT"/apps/*/; do
    [[ -f "$app_path/package.json" ]] || continue
    app="$(basename "$app_path")"
    app_changed "$app" || continue
    if ! grep -q '"check":' "$app_path/package.json"; then
      warn "${app}: no check script, left to CI"
      continue
    fi
    step "${app}: fast checks (bun run check)"
    ( cd "apps/${app}" && bun run check )
    ok "${app} fast checks passed"
  done

  if app_changed ui || grep -q '^packages/' <<< "$CHANGED_PATHS"; then
    step "ui: tests for the files this push changes"
    # Only what this push adds: since the branch's last push, or main for a
    # new branch.
    since="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || echo "$UPSTREAM")"
    ( cd apps/ui && bunx vitest run --changed "$since" --passWithNoTests )
    ok "ui tests for changed files passed"
  fi

  if [[ -z "$CHANGED_PATHS" ]] || grep -q '^packages/' <<< "$CHANGED_PATHS"; then
    step "Running shared packages validate"
    bash -c 'source "$1/scripts/stack-lib.sh" && validate_packages' _ "$ROOT"
    ok "shared packages validate passed"
  fi

  if infra_compose_changed; then
    step "Running infra/compose pre-push gate (compose config + shellcheck + yamllint)"
    bash "$ROOT/infra/compose/scripts/pre-push.sh"
    ok "infra/compose gate passed"
  fi

  ok "Fast pre-push finished. Full suites run in the PR checks; FULL_PREPUSH=1 runs them here."
  exit 0
fi

# Security scanners run first: gitleaks, semgrep, osv-scanner all
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

for app_path in "$ROOT"/apps/*/; do
  [[ -d "$app_path" ]] || continue
  app="$(basename "$app_path")"
  if app_changed "$app"; then
    run_app_gate "$app"
    RAN_ANY=1
  fi
done

# Shared packages run their own validate; they borrow the UI toolchain, so a
# change to them is gated here whether or not any app changed.
if [[ -z "$CHANGED_PATHS" ]] || grep -q '^packages/' <<< "$CHANGED_PATHS"; then
  step "Running shared packages validate"
  bash -c 'source "$1/scripts/stack-lib.sh" && validate_packages' _ "$ROOT"
  ok "shared packages validate passed"
  RAN_ANY=1
fi

if infra_compose_changed; then
  step "Running infra/compose pre-push gate (compose config + shellcheck + yamllint)"
  bash "$ROOT/infra/compose/scripts/pre-push.sh"
  ok "infra/compose gate passed"
  RAN_ANY=1
fi

if [[ "$RAN_ANY" -eq 0 ]]; then
  ok "No app-scoped changes — root pre-push has nothing to gate."
fi

ok "Root pre-push fan-out finished"

# Exit 0 explicitly rather than inheriting the status of the last write.
# Every real failure leaves through `fail` (exit 1) or is aborted by
# `set -e` well before this line, so this cannot mask a broken gate.
exit 0
