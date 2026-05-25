#!/usr/bin/env bash
# Local mirror of apps/api CI gate. Runs everything CI runs so that a
# pre-push failure is the same signal CI would produce.
#
# Stages:
#   1. Fast checks   : typecheck, lint, lint:meta, knip
#   2. Dependency    : osv-scanner against bun.lock
#   3. Services      : ensure Postgres + Valkey are up (via ../../infra/compose)
#   4. Tests         : full suite against real services (integration env)
#   5. Coverage      : coverage gate with warning-clean output
#   6. Build         : production bundle
#   7. OpenAPI drift : if apps/ui exists, regen its schema.d.ts and fail on drift
#   8. ACL drift     : if apps/ui exists, ensure acl.types.generated.ts is in sync
#
# Set ALLOW_OPENAPI_DRIFT_SKIP=false to fail instead of skip when api-dev is not
# running on :3000 (strict mode for release pushes).
# Skipped stages are tracked and reported in the final summary so the
# success message can never imply more than what actually ran.
#
# Bypass: `git push --no-verify` (use sparingly).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

INFRA_DIR="$ROOT/../../infra/compose"
UI_DIR="$ROOT/../ui"
COMPOSE_DIR="$INFRA_DIR/compose"

c_red()    { printf '\033[1;31m%s\033[0m\n' "$*"; }
c_green()  { printf '\033[1;32m%s\033[0m\n' "$*"; }
c_blue()   { printf '\033[1;34m%s\033[0m\n' "$*"; }
c_yellow() { printf '\033[1;33m%s\033[0m\n' "$*"; }

step()    { printf '\n'; c_blue "▶ $*"; }
fail()    { c_red   "✗ $*"; exit 1; }
ok()      { c_green "✓ $*"; }

SKIPPED=()
RAN=0
TOTAL=8

skip() {
  SKIPPED+=("$1")
  c_yellow "  skipped — $1"
}

step "1/${TOTAL} Fast checks (typecheck, lint, lint:meta, knip)"
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

step "3/${TOTAL} Ensure Postgres + Valkey are running"
probe_tcp() { nc -z "$1" "$2" 2>/dev/null; }

if probe_tcp localhost 5432 && probe_tcp localhost 6379; then
  ok "Postgres + Valkey already up"
else
  if [ ! -x "$COMPOSE_DIR/dev.sh" ]; then
    fail "Infra dev stack not found at $COMPOSE_DIR/dev.sh. Expected ../../infra/compose sibling checkout."
  fi
  if ! docker ps >/dev/null 2>&1; then
    fail "Docker daemon not running. Start OrbStack / Docker Desktop and re-push."
  fi
  c_blue "  starting dev stack (one-time per session, ~20s)…"
  (cd "$COMPOSE_DIR" && ./dev.sh up -d postgres valkey api-migrate-dev >/dev/null)
  for _ in $(seq 1 30); do
    if probe_tcp localhost 5432 && probe_tcp localhost 6379; then
      break
    fi
    sleep 1
  done
  probe_tcp localhost 5432 || fail "Postgres did not become reachable on :5432"
  probe_tcp localhost 6379 || fail "Valkey did not become reachable on :6379"
  ok "dev stack ready"
fi
RAN=$((RAN + 1))

step "4/${TOTAL} Test suite (integration)"
export REQUIRE_INTEGRATION_DB=true
export RUN_VALKEY_NETWORK_TESTS=true
export DATABASE_URL="${DATABASE_URL:-postgresql://app:app_dev_password@localhost:5432/app}"
bun run test
ok "tests passed"
RAN=$((RAN + 1))

step "5/${TOTAL} Test coverage"
bun run test:coverage
ok "coverage gate passed"
RAN=$((RAN + 1))

step "6/${TOTAL} Production build"
bun run build
ok "build passed"
RAN=$((RAN + 1))

step "7/${TOTAL} OpenAPI schema drift"
if [ ! -d "$UI_DIR" ]; then
  skip "apps/ui not present"
elif ! probe_tcp localhost 3000; then
  if [ "${ALLOW_OPENAPI_DRIFT_SKIP:-true}" = "false" ]; then
    fail "api-dev not running on :3000 (run 'compose/dev.sh up -d api-dev' or set ALLOW_OPENAPI_DRIFT_SKIP=true)"
  else
    skip "api-dev not running on :3000 (run 'compose/dev.sh up -d api-dev' to enable)"
  fi
else
  if [ ! -d "$UI_DIR/node_modules" ]; then
    c_blue "  installing apps/ui deps for schema check…"
    (cd "$UI_DIR" && bun install --frozen-lockfile >/dev/null)
  fi
  (cd "$UI_DIR" && OPENAPI_URL=http://localhost:3000/swagger/json node_modules/.bin/tsx scripts/codegen/generate-api.ts --check)
  ok "apps/ui schema is fresh"
  RAN=$((RAN + 1))
fi

step "8/${TOTAL} ACL types drift"
if [ ! -d "$UI_DIR" ]; then
  skip "apps/ui not present"
else
  bun run generate:acl-types:check
  ok "apps/ui ACL types are in sync"
  RAN=$((RAN + 1))
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
