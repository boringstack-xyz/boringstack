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

# Isolate the smoke stack under its own compose project. The pre-push smoke
# gate tears its stack down with `down -v`; without isolation that removes the
# shared Postgres/Valkey volumes the api test gate then depends on, so tests
# hit an empty schema ("audit.audit_log does not exist"). A dedicated project
# means `down -v` can only ever drop smoke's own volumes. dev/prod keep the
# docker-compose.yml `name:` (boringstack-infra).
PROJECT_ARGS=()
if [[ "$STACK" == "smoke" ]]; then
  PROJECT_ARGS=(-p boringstack-smoke)
fi

# Observability + GlitchTip default to ON for dev and prod — you can't build
# muscle memory for a dashboard you've never seen until prod day-one. They
# stay OFF for `smoke` (full-stack-smoke CI doesn't need them and the extra
# containers slow the test loop). Override per-run with WITH_OBSERVABILITY=0
# / WITH_GLITCHTIP=0.
case "$STACK" in
  smoke) WITH_OBSERVABILITY_DEFAULT=0; WITH_GLITCHTIP_DEFAULT=0 ;;
  *)     WITH_OBSERVABILITY_DEFAULT=1; WITH_GLITCHTIP_DEFAULT=1 ;;
esac
WITH_OBSERVABILITY="${WITH_OBSERVABILITY:-$WITH_OBSERVABILITY_DEFAULT}"
WITH_GLITCHTIP="${WITH_GLITCHTIP:-$WITH_GLITCHTIP_DEFAULT}"

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
    if [[ "$WITH_GLITCHTIP" == "1" ]]; then
      : "${GLITCHTIP_SECRET_KEY:?GLITCHTIP_SECRET_KEY required in prod when GlitchTip is enabled. Generate with: openssl rand -base64 50. Set WITH_GLITCHTIP=0 to skip GlitchTip entirely.}"
      : "${GLITCHTIP_PUBLIC_HOST:?GLITCHTIP_PUBLIC_HOST required in prod (DNS name for the GlitchTip router, e.g. glitchtip.example.com). Set WITH_GLITCHTIP=0 to skip.}"
      : "${GLITCHTIP_BASIC_AUTH_USERS:?GLITCHTIP_BASIC_AUTH_USERS required in prod (htpasswd format, escape \$ as \$\$). Set WITH_GLITCHTIP=0 to skip.}"
      : "${GLITCHTIP_SUPERUSER_PASSWORD:?GLITCHTIP_SUPERUSER_PASSWORD required in prod when GlitchTip is enabled. Generate with: openssl rand -base64 24. Set WITH_GLITCHTIP=0 to skip.}"
      if [[ "$GLITCHTIP_SUPERUSER_PASSWORD" == "admin123456" ]]; then
        echo "[ERROR] GLITCHTIP_SUPERUSER_PASSWORD must not be the dev default (admin123456) in prod. Generate with: openssl rand -base64 24." >&2
        exit 1
      fi
    fi
    ;;
  *)
    echo "[ERROR] STACK must be \"dev\", \"smoke\", or \"prod\" (got: ${STACK})" >&2
    exit 1
    ;;
esac

# Dev-only fallback so a fresh clone boots without manual .env editing.
# Prod requires the operator to generate their own (guarded above).
if [[ "$WITH_GLITCHTIP" == "1" && "$STACK" != "prod" && -z "${GLITCHTIP_SECRET_KEY:-}" ]]; then
  export GLITCHTIP_SECRET_KEY="dev-only-not-secret-replace-in-prod-pHnZx7s2qB4eYwLm3KvR8tDfJ5cVgHp1aN6yT0uX9oI="
fi

if [[ "$WITH_OBSERVABILITY" == "1" && -f "$ROOT/docker-compose.observability.yml" ]]; then
  COMPOSE_FILES+=(-f "$ROOT/docker-compose.observability.yml")
  PROFILE_ARGS+=(--profile observability)
fi

if [[ "$WITH_GLITCHTIP" == "1" && -f "$ROOT/docker-compose.glitchtip.yml" ]]; then
  COMPOSE_FILES+=(-f "$ROOT/docker-compose.glitchtip.yml")
  PROFILE_ARGS+=(--profile "glitchtip-${STACK}")
  # In prod, layer the GlitchTip prod labels (HTTPS + Basic Auth + CORS).
  if [[ "$STACK" == "prod" && -f "$ROOT/docker-compose.glitchtip-prod-labels.yml" ]]; then
    COMPOSE_FILES+=(-f "$ROOT/docker-compose.glitchtip-prod-labels.yml")
  fi
  # In dev, publish glitchtip-web on host port 8055 so the operator
  # can open it directly (Traefik is prod-only, so the Traefik labels
  # in the base overlay don't route anything in dev).
  if [[ "$STACK" == "dev" && -f "$ROOT/docker-compose.glitchtip-dev-ports.yml" ]]; then
    COMPOSE_FILES+=(-f "$ROOT/docker-compose.glitchtip-dev-ports.yml")
  fi
fi

if [[ "${WITH_BULLMQ:-}" == "" && "$STACK" == "dev" ]]; then
  WITH_BULLMQ=1
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

if [[ "${WITH_MAILPIT:-}" == "" && "$STACK" == "dev" ]]; then
  WITH_MAILPIT=1
fi

if [[ "${WITH_MAILPIT:-0}" == "1" && "$STACK" == "dev" && -f "$ROOT/docker-compose.mailpit.yml" ]]; then
  COMPOSE_FILES+=(-f "$ROOT/docker-compose.mailpit.yml")
  PROFILE_ARGS+=(--profile mailpit)
  # Point api-dev at the mailpit catcher only when STACK=dev. The smoke
  # profile shares the api-dev service but doesn't run mailpit, so the
  # SMTP target only makes sense in dev.
  export API_DEV_EMAIL_PROVIDER="${API_DEV_EMAIL_PROVIDER:-smtp}"
  export API_DEV_SMTP_HOST="${API_DEV_SMTP_HOST:-mailpit}"
  export API_DEV_SMTP_PORT="${API_DEV_SMTP_PORT:-1025}"
fi

if [[ $# -eq 0 ]]; then
  set -- up -d
fi

# Auto-wire GlitchTip → API/UI DSNs after a detached `up` on the dev stack.
# Skipped for prod (operator owns those DSNs), smoke (no GlitchTip), and
# non-up actions (down/logs/ps/etc.) which run a pass-through compose call.
WIRE_GLITCHTIP=0
if [[ "$STACK" == "dev" && "$WITH_GLITCHTIP" == "1" && "${1:-}" == "up" ]]; then
  for arg in "$@"; do
    if [[ "$arg" == "-d" || "$arg" == "--detach" ]]; then
      WIRE_GLITCHTIP=1
      break
    fi
  done
fi

# Auto-wire VAPID keypair on the first detached `up` of the dev stack.
# Skipped for prod (operator manages keypair rotation explicitly), smoke
# (no push channel under test), and non-up actions.
WIRE_VAPID=0
if [[ "$STACK" == "dev" && "${1:-}" == "up" ]]; then
  for arg in "$@"; do
    if [[ "$arg" == "-d" || "$arg" == "--detach" ]]; then
      WIRE_VAPID=1
      break
    fi
  done
fi

if [[ "$WIRE_GLITCHTIP" == "1" || "$WIRE_VAPID" == "1" ]]; then
  docker compose "${COMPOSE_FILES[@]}" "${PROJECT_ARGS[@]}" "${PROFILE_ARGS[@]}" "$@"
  # Background — both scripts are idempotent and silent when wiring is
  # already done. Foregrounding them would hold the dev loop on every
  # `up` for first-boot bootstraps that only matter once.
  if [[ "$WIRE_GLITCHTIP" == "1" ]]; then
    ( "$ROOT/../scripts/glitchtip-fetch-dsn.sh" --quiet & ) >/dev/null 2>&1
  fi
  if [[ "$WIRE_VAPID" == "1" ]]; then
    ( "$ROOT/../scripts/dev-vapid-init.sh" --quiet & ) >/dev/null 2>&1
  fi
else
  exec docker compose "${COMPOSE_FILES[@]}" "${PROJECT_ARGS[@]}" "${PROFILE_ARGS[@]}" "$@"
fi
