#!/usr/bin/env bash
# Hermetic regression checks: external commands and services are fixtures.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FIXTURE="$(mktemp -d "${TMPDIR:-/tmp}/bs-push-regression.XXXXXX")"
trap 'rm -rf "$FIXTURE"' EXIT
REAL_BUN="$(command -v bun)"
export REAL_BUN
export FIXTURE
mkdir -p "$FIXTURE/apps/api/scripts/ci" "$FIXTURE/infra/compose/compose" "$FIXTURE/bin"
cp "$ROOT/apps/api/scripts/ci/pre-push.sh" "$FIXTURE/apps/api/scripts/ci/pre-push.sh"
cat > "$FIXTURE/bin/bun" <<'STUB'
#!/bin/bash
set -eu
if [[ "$1" == "-e" ]]; then
  if [[ "$2" == *'import postgres'* ]]; then
    printf 'database-ready\n' >> "$FIXTURE/commands"
    [[ -f "$FIXTURE/ready" && "${FAIL_DATABASE_READY:-0}" != 1 ]]
    exit "$?"
  fi
  exec "$REAL_BUN" "$@"
fi
printf '%s|%s|%s\n' "$*" "$DATABASE_URL" "$TEST_DATABASE_URL" >> "$FIXTURE/commands"
if [[ "$*" == 'run db:migrate' && "${FAIL_MIGRATION:-0}" == 1 ]]; then exit 1; fi
STUB
cat > "$FIXTURE/bin/nc" <<'STUB'
#!/bin/bash
printf '%s %s\n' "$2" "$3" >> "$FIXTURE/probes"
[[ -f "$FIXTURE/ready" && ( "$3" == 55432 || "$3" == 56379 ) ]]
STUB
cat > "$FIXTURE/bin/docker" <<'STUB'
#!/bin/bash
printf '%s|%s|%s\n' "$*" "${POSTGRES_HOST_PORT:-}" "${VALKEY_HOST_PORT:-}" >> "$FIXTURE/docker"
STUB
cat > "$FIXTURE/infra/compose/compose/dev.sh" <<'STUB'
#!/bin/bash
printf '%s|%s|%s\n' "$*" "$POSTGRES_HOST_PORT" "$VALKEY_HOST_PORT" >> "$FIXTURE/boot"
touch "$FIXTURE/ready"
STUB
printf '#!/bin/bash\nexit 0\n' > "$FIXTURE/bin/osv-scanner"
printf '#!/bin/bash\nexit 0\n' > "$FIXTURE/bin/sleep"
chmod +x "$FIXTURE/bin/"* "$FIXTURE/infra/compose/compose/dev.sh"
export PATH="$FIXTURE/bin:$PATH"
export DATABASE_URL='postgresql://fixture:fixture@127.0.0.1:59999/wrong'
export TEST_DATABASE_URL='postgresql://fixture:fixture@127.0.0.1:55432/test'
export VALKEY_HOST=127.0.0.1 VALKEY_PORT=56379
run_gate() { /bin/bash "$FIXTURE/apps/api/scripts/ci/pre-push.sh" > "$FIXTURE/output" 2>&1; }
assert_contains() { grep -F -- "$2" "$1" >/dev/null || { cat "$FIXTURE/output"; exit 1; }; }
assert_absent() { if [[ -f "$1" ]] && grep -F -- "$2" "$1" >/dev/null; then exit 1; fi; }

touch "$FIXTURE/ready"
run_gate
assert_contains "$FIXTURE/probes" '127.0.0.1 55432'
assert_contains "$FIXTURE/probes" '127.0.0.1 56379'
assert_absent "$FIXTURE/probes" ' 6379'
assert_contains "$FIXTURE/commands" "run db:migrate|$TEST_DATABASE_URL|$TEST_DATABASE_URL"
assert_contains "$FIXTURE/commands" 'run test|'
[[ ! -f "$FIXTURE/boot" ]]
echo 'PASS configured endpoints and migration/test target agree'

: > "$FIXTURE/commands"
if FAIL_MIGRATION=1 run_gate; then exit 1; fi
assert_absent "$FIXTURE/commands" 'run test|'
echo 'PASS migration failure prevents tests'

: > "$FIXTURE/commands"
if FAIL_DATABASE_READY=1 run_gate; then exit 1; fi
assert_absent "$FIXTURE/commands" 'run db:migrate|'
echo 'PASS bound port without authenticated database readiness blocks migration'

: > "$FIXTURE/commands"
if TEST_DATABASE_URL=invalid run_gate; then exit 1; fi
assert_absent "$FIXTURE/commands" 'run db:migrate|'
echo 'PASS invalid URL prevents migration'

rm "$FIXTURE/ready"
if TEST_DATABASE_URL='postgresql://fixture:fixture@db.example.test:55432/test' run_gate; then exit 1; fi
[[ ! -f "$FIXTURE/boot" ]]
echo 'PASS unavailable remote endpoint does not start local services'

run_gate
assert_contains "$FIXTURE/boot" 'up -d postgres valkey|55432|56379'
echo 'PASS local startup forwards selected host ports'

# Run the actual Compose launcher under macOS-compatible Bash with no optional
# project flags. Stub docker captures arguments without contacting a daemon.
cp "$ROOT/infra/compose/compose/dev.sh" "$FIXTURE/infra/compose/compose/dev.sh"
printf 'POSTGRES_HOST_PORT=5432\nVALKEY_HOST_PORT=6379\n' > "$FIXTURE/ports.env"
ENV_FILE="$FIXTURE/ports.env" STACK=dev WITH_OBSERVABILITY=0 WITH_GLITCHTIP=0 \
 POSTGRES_HOST_PORT=55432 VALKEY_HOST_PORT=56379 \
 /bin/bash "$FIXTURE/infra/compose/compose/dev.sh" config
assert_contains "$FIXTURE/docker" '--profile dev config|55432|56379'
echo 'PASS Bash empty-project arguments and caller port precedence'

# A failure during startup must run cleanup, before any Playwright execution.
mkdir -p "$FIXTURE/scripts/ci"
cp "$ROOT/scripts/ci/pre-push-smoke.sh" "$FIXTURE/scripts/ci/pre-push-smoke.sh"
cat > "$FIXTURE/bin/git" <<'STUB'
#!/bin/bash
if [[ "$1" == 'diff' ]]; then echo apps/api/src/api/auth/auth.routes.ts; fi
STUB
printf '#!/bin/bash\nexit 1\n' > "$FIXTURE/bin/curl"
cat > "$FIXTURE/infra/compose/compose/dev.sh" <<'STUB'
#!/bin/bash
printf '%s\n' "$*" >> "$FIXTURE/smoke"
[[ "$1" == down ]]
STUB
chmod +x "$FIXTURE/bin/git" "$FIXTURE/bin/curl"
if /bin/bash "$FIXTURE/scripts/ci/pre-push-smoke.sh" > "$FIXTURE/output" 2>&1; then exit 1; fi
assert_contains "$FIXTURE/smoke" 'up -d --build'
assert_contains "$FIXTURE/smoke" 'down -v'
echo 'PASS failed smoke startup tears down owned resources'

# Config validation must not replace the developer's Compose credentials.
mkdir -p "$FIXTURE/infra/compose/scripts"
cp "$ROOT/infra/compose/scripts/pre-push.sh" "$FIXTURE/infra/compose/scripts/pre-push.sh"
printf 'LOCAL_ENV_MUST_SURVIVE=true\n' > "$FIXTURE/infra/compose/compose/.env"
printf 'SAMPLE=fixture\n' > "$FIXTURE/infra/compose/compose/.env.example"
printf '#!/bin/bash\nexit 0\n' > "$FIXTURE/infra/compose/scripts/validate-guardrails.sh"
cat > "$FIXTURE/bin/git" <<'STUB'
#!/bin/bash
printf '%s\n' "$FIXTURE"
STUB
cat > "$FIXTURE/bin/docker" <<'STUB'
#!/bin/bash
if [[ "$1" == compose ]]; then printf '%s\n' "$COMPOSE_ENV_FILES" > "$FIXTURE/config-env"; fi
STUB
for command in shellcheck yamllint; do
  printf '#!/bin/bash\nexit 0\n' > "$FIXTURE/bin/$command"
  chmod +x "$FIXTURE/bin/$command"
done
chmod +x "$FIXTURE/infra/compose/scripts/validate-guardrails.sh"
mkdir -p "$FIXTURE/apps/ui"
/bin/bash "$FIXTURE/infra/compose/scripts/pre-push.sh" > "$FIXTURE/output" 2>&1
[[ "$(cat "$FIXTURE/infra/compose/compose/.env")" == LOCAL_ENV_MUST_SURVIVE=true ]]
[[ ! -f "$(cat "$FIXTURE/config-env")" ]]
echo 'PASS Compose validation preserves local env and removes temporary config'
