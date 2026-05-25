#!/usr/bin/env bash
# Local mirror of ui-template's CI gate. Runs everything CI runs so that a
# pre-push failure is the same signal CI would produce.
#
# Stages:
#   1. Fast checks   : lint, lint:meta, format, typecheck, knip
#   2. Dependency    : osv-scanner against bun.lock
#   3. Tests         : vitest run --coverage (no services needed)
#   4. Build         : vite build (catches type-level regressions through routes)
#   5. Size          : size-limit budget
#   6. OpenAPI drift : if api-template is reachable on :3000, ensure schema is fresh
#
# Set ALLOW_OPENAPI_DRIFT_SKIP=false to fail instead of skip when the API is
# unreachable (strict mode for release pushes).
# Skipped stages are tracked and reported in the final summary so the
# success message can never imply more than what actually ran.
#
# Bypass: `git push --no-verify`.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

c_red()    { printf '\033[1;31m%s\033[0m\n' "$*"; }
c_green()  { printf '\033[1;32m%s\033[0m\n' "$*"; }
c_blue()   { printf '\033[1;34m%s\033[0m\n' "$*"; }
c_yellow() { printf '\033[1;33m%s\033[0m\n' "$*"; }

step()    { printf '\n'; c_blue "▶ $*"; }
fail()    { c_red   "✗ $*"; exit 1; }
ok()      { c_green "✓ $*"; }

SKIPPED=()
RAN=0
TOTAL=6

skip() {
  SKIPPED+=("$1")
  c_yellow "  skipped — $1"
}

step "1/${TOTAL} Fast checks (lint, lint:meta, format, typecheck, knip)"
bun run check
ok "check passed"
RAN=$((RAN + 1))

step "2/${TOTAL} Dependency vulnerability scan"
if ! command -v osv-scanner >/dev/null 2>&1; then
  fail "osv-scanner not installed. Install with: brew install osv-scanner"
fi
osv-scanner --config="$ROOT/osv-scanner.toml" --lockfile="$ROOT/bun.lock"
ok "osv-scanner clean"
RAN=$((RAN + 1))

step "3/${TOTAL} Tests"
bun run test:ci
ok "tests passed"
RAN=$((RAN + 1))

step "4/${TOTAL} Production build"
bun run build
ok "build passed"
RAN=$((RAN + 1))

step "5/${TOTAL} Bundle size budgets"
bun run size:check
bun run size:check:modulepreload
ok "size budgets met"
RAN=$((RAN + 1))

step "6/${TOTAL} OpenAPI schema drift"
probe_tcp() { nc -z "$1" "$2" 2>/dev/null; }
if probe_tcp localhost 3000 && curl -fsS http://localhost:3000/swagger/json >/dev/null 2>&1; then
  OPENAPI_URL=http://localhost:3000/swagger/json bun run generate:api:check
  ok "schema is fresh"
  RAN=$((RAN + 1))
elif [ "${ALLOW_OPENAPI_DRIFT_SKIP:-true}" = "false" ]; then
  fail "api-template not reachable on :3000 (start api-dev or set ALLOW_OPENAPI_DRIFT_SKIP=true)"
else
  skip "api-template not reachable on :3000"
fi

printf '\n'
if [ "${#SKIPPED[@]}" -eq 0 ]; then
  c_green "✓ pre-push: all ${TOTAL} gates passed"
else
  c_yellow "⚠ pre-push: ${RAN}/${TOTAL} gates passed — ${#SKIPPED[@]} skipped:"
  for reason in "${SKIPPED[@]}"; do
    c_yellow "    • $reason"
  done
  c_green "✓ all gates that ran passed; push allowed"
fi
