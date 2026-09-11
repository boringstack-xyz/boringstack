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
# running on :7330 (strict mode for release pushes).
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

step "3/${TOTAL} Ensure Postgres + Valkey are running and migrated"
probe_tcp() { nc -z "$1" "$2" 2>/dev/null; }
# Migration and tests must use the same selected database. A separate test URL
# takes precedence, matching the test preload's target selection.
export DATABASE_URL="${TEST_DATABASE_URL:-${DATABASE_URL:-postgresql://app:app_dev_password@127.0.0.1:${POSTGRES_HOST_PORT:-5432}/app}}"
export TEST_DATABASE_URL="$DATABASE_URL"
export VALKEY_HOST="${VALKEY_HOST:-127.0.0.1}"
export VALKEY_PORT="${VALKEY_PORT:-${VALKEY_HOST_PORT:-6379}}"
DB_ADDRESS="$(bun -e '
  try {
    const url = new URL(process.env.DATABASE_URL);
    if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error();
    console.log(url.hostname.replace(/^\[|\]$/g, "") + " " + (url.port || "5432"));
  } catch {
    console.error("Invalid test database URL");
    process.exit(1);
  }
')" || fail "Cannot resolve the configured test database endpoint"
read -r DB_HOST DB_PORT <<< "$DB_ADDRESS"

services_ready() {
  probe_tcp "$DB_HOST" "$DB_PORT" && probe_tcp "$VALKEY_HOST" "$VALKEY_PORT"
}

is_loopback() {
  [[ "$1" == "localhost" || "$1" == "127.0.0.1" || "$1" == "::1" ]]
}

if services_ready; then
  ok "Configured Postgres + Valkey endpoints are reachable"
else
  if ! is_loopback "$DB_HOST" || ! is_loopback "$VALKEY_HOST"; then
    fail "Configured test services are unavailable; refusing to start unrelated local services for remote endpoints"
  fi
  if [ ! -x "$COMPOSE_DIR/dev.sh" ]; then
    fail "Infra dev stack not found at $COMPOSE_DIR/dev.sh"
  fi
  if ! docker ps >/dev/null 2>&1; then
    fail "Docker daemon not running. Start OrbStack / Docker Desktop and re-push."
  fi
  c_blue "  starting local data services on configured host ports…"
  (
    cd "$COMPOSE_DIR"
    POSTGRES_HOST_PORT="$DB_PORT" VALKEY_HOST_PORT="$VALKEY_PORT" \
      ./dev.sh up -d postgres valkey >/dev/null
  )
  for _ in $(seq 1 30); do
    if services_ready; then
      break
    fi
    sleep 1
  done
  probe_tcp "$DB_HOST" "$DB_PORT" || fail "Postgres did not become reachable on the configured test endpoint"
  probe_tcp "$VALKEY_HOST" "$VALKEY_PORT" || fail "Valkey did not become reachable on the configured test endpoint"
  ok "test services ready"
fi

# A bound Docker port can accept TCP before Postgres finishes initialization.
# Confirm a real authenticated query before running migrations.
database_ready() {
  bun -e '
    import postgres from "postgres";
    const sql = postgres(process.env.DATABASE_URL, { connect_timeout: 2, max: 1 });
    try {
      await sql.unsafe("SELECT 1");
    } catch {
      process.exitCode = 1;
    } finally {
      await sql.end({ timeout: 1 });
    }
  ' >/dev/null 2>&1
}
for _ in $(seq 1 30); do
  if database_ready; then
    break
  fi
  sleep 1
done
database_ready || fail "Configured test database did not become ready for authenticated queries"

# Run the migration synchronously against the selected test database. A Compose
# migration container can target a different database and detached startup does
# not establish that the migration completed successfully.
c_blue "  applying migrations to the selected test database…"
bun run db:migrate
ok "schema migrated"
RAN=$((RAN + 1))

step "4/${TOTAL} Test suite (integration)"
export REQUIRE_INTEGRATION_DB=true
export RUN_VALKEY_NETWORK_TESTS=true
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
elif ! probe_tcp localhost 7330; then
  if [ "${ALLOW_OPENAPI_DRIFT_SKIP:-true}" = "false" ]; then
    fail "api-dev not running on :7330 (run 'compose/dev.sh up -d api-dev' or set ALLOW_OPENAPI_DRIFT_SKIP=true)"
  else
    skip "api-dev not running on :7330 (run 'compose/dev.sh up -d api-dev' to enable)"
  fi
else
  if [ ! -d "$UI_DIR/node_modules" ]; then
    c_blue "  installing apps/ui deps for schema check…"
    (cd "$UI_DIR" && bun install --frozen-lockfile >/dev/null)
  fi
  (cd "$UI_DIR" && OPENAPI_URL=http://localhost:7330/swagger/json node_modules/.bin/tsx scripts/codegen/generate-api.ts --check)
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
