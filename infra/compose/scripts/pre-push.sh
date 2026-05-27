#!/usr/bin/env bash
# Local mirror of infra/compose CI gate. Runs the fast validate-compose checks
# so a pre-push failure is the same signal CI would produce.
#
# Stages:
#   1. Compose config : docker compose config --quiet across every overlay combo
#   2. shellcheck     : compose/dev.sh + scripts/*.sh
#   3. yamllint       : compose/*.yml + workflows
#
# full-stack-smoke is intentionally NOT run here — it's a 3–5 minute end-to-end
# stack boot. CI runs it on push. Run it locally with `compose/dev.sh up -d`
# and `curl http://localhost:7330/health` if you want the full e2e signal.
#
# Bypass: `git push --no-verify`.

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
COMPOSE_DIR="$ROOT/infra/compose/compose"
INFRA_ROOT="$ROOT/infra/compose"

c_red()   { printf '\033[1;31m%s\033[0m\n' "$*"; }
c_green() { printf '\033[1;32m%s\033[0m\n' "$*"; }
c_blue()  { printf '\033[1;34m%s\033[0m\n' "$*"; }

step()    { printf '\n'; c_blue "▶ $*"; }
fail()    { c_red   "✗ $*"; exit 1; }
ok()      { c_green "✓ $*"; }

if ! docker version >/dev/null 2>&1; then
  fail "Docker daemon not running. Start OrbStack / Docker Desktop and re-push."
fi

if [[ ! -d "$ROOT/apps/api" || ! -d "$ROOT/apps/ui" ]]; then
  fail "Expected monorepo apps at $ROOT/apps/api and $ROOT/apps/ui"
fi

# Seed an .env mirroring CI so prod overlays validate too.
cp "$COMPOSE_DIR/.env.example" "$COMPOSE_DIR/.env" 2>/dev/null || true
{
  echo "GLITCHTIP_SECRET_KEY=ci-local-placeholder-secret-key"
  echo "GLITCHTIP_PUBLIC_HOST=glitchtip.example.com"
  echo "GLITCHTIP_BASIC_AUTH_USERS=user:placeholder"
} >> "$COMPOSE_DIR/.env"

config() {
  local name="$1"
  shift
  c_blue "  config: $name"
  (cd "$COMPOSE_DIR" && docker compose "$@" --quiet >/dev/null)
}

step "1/3 Compose config validation (every overlay combo)"
config "dev (base)" -f docker-compose.yml -f docker-compose.development-labels.yml --profile dev config
config "prod (base)" -f docker-compose.yml -f docker-compose.production-labels.yml --profile prod config
config "dev + observability" -f docker-compose.yml -f docker-compose.development-labels.yml -f docker-compose.observability.yml --profile dev --profile observability config
config "dev + glitchtip" -f docker-compose.yml -f docker-compose.development-labels.yml -f docker-compose.glitchtip.yml --profile dev --profile glitchtip-dev config
config "prod + glitchtip (+ prod labels)" -f docker-compose.yml -f docker-compose.production-labels.yml -f docker-compose.glitchtip.yml -f docker-compose.glitchtip-prod-labels.yml --profile prod --profile glitchtip-prod config
config "dev + bullmq" -f docker-compose.yml -f docker-compose.development-labels.yml -f docker-compose.bullmq.yml --profile dev --profile bullmq config
config "dev + wud" -f docker-compose.yml -f docker-compose.development-labels.yml -f docker-compose.wud.yml --profile dev --profile wud config
config "kitchen-sink (dev + all overlays)" -f docker-compose.yml -f docker-compose.development-labels.yml -f docker-compose.observability.yml -f docker-compose.glitchtip.yml -f docker-compose.bullmq.yml -f docker-compose.wud.yml --profile dev --profile observability --profile glitchtip-dev --profile bullmq --profile wud config
ok "compose configs valid"

step "2/3 shellcheck"
if ! command -v shellcheck >/dev/null 2>&1; then
  c_blue "  skipped — shellcheck not installed (brew install shellcheck). CI still runs it."
else
  shellcheck -x -S warning "$COMPOSE_DIR/dev.sh" "$INFRA_ROOT"/scripts/*.sh
  ok "shellcheck clean"
fi

step "3/3 yamllint"
if ! command -v yamllint >/dev/null 2>&1; then
  c_blue "  skipped — yamllint not installed (brew install yamllint). CI still runs it."
else
  yamllint -d "{extends: default, rules: {line-length: disable, document-start: disable, truthy: {check-keys: false}}}" \
    "$COMPOSE_DIR"/*.yml "$INFRA_ROOT/.github/workflows"/*.yml
  ok "yamllint clean"
fi

printf '\n'
c_green "✓ pre-push: all gates passed"
