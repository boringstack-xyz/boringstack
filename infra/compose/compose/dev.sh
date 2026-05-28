#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-$ROOT/.env}"
# Preserve a STACK passed in by the caller (e.g. `STACK=smoke ./dev.sh up`)
# before sourcing .env — without this snapshot, the `.env` file's own
# `STACK=dev` line would overwrite it and silently demote smoke runs back
# to the dev stack.
STACK_FROM_CALLER="${STACK:-}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

if [[ -n "$STACK_FROM_CALLER" ]]; then
  STACK="$STACK_FROM_CALLER"
fi
STACK="${STACK:-dev}"
COMPOSE_FILES=(-f "$ROOT/docker-compose.yml")
PROFILE_ARGS=()

case "$STACK" in
  dev)
    COMPOSE_FILES+=(-f "$ROOT/docker-compose.development-labels.yml")
    PROFILE_ARGS+=(--profile dev)
    ;;
  smoke)
    # `smoke` runs the dev-mode api but swaps the Vite dev server for a
    # production-built nginx-served UI bundle. Designed for the
    # full-stack-smoke CI workflow and any local "test the prod build
    # against the dev API" loop. Reuses dev data-service ports so
    # `psql`, `valkey-cli`, and curl against :7330 still work.
    COMPOSE_FILES+=(-f "$ROOT/docker-compose.development-labels.yml")
    PROFILE_ARGS+=(--profile smoke)
    ;;
  prod)
    COMPOSE_FILES+=(-f "$ROOT/docker-compose.production-labels.yml")
    PROFILE_ARGS+=(--profile prod)
    : "${POSTGRES_USER:?POSTGRES_USER required in prod. Set in compose/.env or via terraform.tfvars.}"
    : "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD required in prod. Set in compose/.env or via terraform.tfvars.}"
    : "${POSTGRES_DB:?POSTGRES_DB required in prod. Set in compose/.env or via terraform.tfvars.}"
    : "${JWT_SECRET:?JWT_SECRET required in prod (>=32 chars). Generate with: openssl rand -base64 48}"
    : "${MFA_ENCRYPTION_KEY:?MFA_ENCRYPTION_KEY required in prod once users enable MFA (base64 32 bytes). Generate with: openssl rand -base64 32}"
    : "${FRONTEND_URL:?FRONTEND_URL required in prod. e.g. https://example.com}"
    : "${PUBLIC_API_URL:?PUBLIC_API_URL required in prod. Same-origin example: https://example.com/api}"
    : "${PUBLIC_UI_HOST:?PUBLIC_UI_HOST required in prod. Bare DNS name, e.g. example.com}"
    : "${ACME_EMAIL:?ACME_EMAIL required in prod for ACME/Lets Encrypt. e.g. you@example.com}"
    ;;
  *)
    echo "[ERROR] STACK must be \"dev\", \"smoke\", or \"prod\" (got: ${STACK})" >&2
    exit 1
    ;;
esac

if [[ "${WITH_OBSERVABILITY:-0}" == "1" && -f "$ROOT/docker-compose.observability.yml" ]]; then
  COMPOSE_FILES+=(-f "$ROOT/docker-compose.observability.yml")
  PROFILE_ARGS+=(--profile observability)
fi

if [[ "${WITH_GLITCHTIP:-0}" == "1" && -f "$ROOT/docker-compose.glitchtip.yml" ]]; then
  COMPOSE_FILES+=(-f "$ROOT/docker-compose.glitchtip.yml")
  PROFILE_ARGS+=(--profile "glitchtip-${STACK}")
  # In prod, layer the GlitchTip prod labels (HTTPS + Basic Auth + CORS).
  if [[ "$STACK" == "prod" && -f "$ROOT/docker-compose.glitchtip-prod-labels.yml" ]]; then
    COMPOSE_FILES+=(-f "$ROOT/docker-compose.glitchtip-prod-labels.yml")
  fi
fi

if [[ "${WITH_BULLMQ:-0}" == "1" && "$STACK" == "dev" && -f "$ROOT/docker-compose.bullmq.yml" ]]; then
  COMPOSE_FILES+=(-f "$ROOT/docker-compose.bullmq.yml")
  PROFILE_ARGS+=(--profile bullmq)
fi

if [[ "${WITH_WUD:-}" == "" && "$STACK" == "prod" ]]; then
  WITH_WUD=1
fi

if [[ "${WITH_WUD:-0}" == "1" && -f "$ROOT/docker-compose.wud.yml" ]]; then
  COMPOSE_FILES+=(-f "$ROOT/docker-compose.wud.yml")
  PROFILE_ARGS+=(--profile wud)
fi

if [[ "${WITH_MAILPIT:-0}" == "1" && "$STACK" == "dev" && -f "$ROOT/docker-compose.mailpit.yml" ]]; then
  COMPOSE_FILES+=(-f "$ROOT/docker-compose.mailpit.yml")
  PROFILE_ARGS+=(--profile mailpit)
fi

if [[ $# -eq 0 ]]; then
  set -- up -d
fi

exec docker compose "${COMPOSE_FILES[@]}" "${PROFILE_ARGS[@]}" "$@"
