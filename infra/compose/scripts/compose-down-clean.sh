#!/usr/bin/env bash
# Stop the stack AND remove its named volumes.
#
# DANGER: this deletes the Postgres data volume (`postgres_data`) and the
# Valkey data volume (`valkey_data`). All seeded users, schema, and queued
# jobs are gone. Use `compose-down.sh` if you only want to stop the stack.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/compose"

ENV_FILE="${ENV_FILE:-$ROOT/compose/.env}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

STACK="${STACK:-dev}"
COMPOSE_FILES=(-f "$ROOT/compose/docker-compose.yml")
PROFILE_ARGS=()

# Mirror dev.sh defaults so the teardown matches the bring-up surface.
WITH_OBSERVABILITY="${WITH_OBSERVABILITY:-1}"
WITH_GLITCHTIP="${WITH_GLITCHTIP:-1}"

case "$STACK" in
  dev)
    COMPOSE_FILES+=(-f "$ROOT/compose/docker-compose.development-labels.yml")
    PROFILE_ARGS+=(--profile dev)
    ;;
  prod)
    COMPOSE_FILES+=(-f "$ROOT/compose/docker-compose.production-labels.yml")
    PROFILE_ARGS+=(--profile prod)
    ;;
  *)
    echo "[ERROR] STACK must be \"dev\" or \"prod\" (got: ${STACK})" >&2
    exit 1
    ;;
esac

if [[ "$WITH_OBSERVABILITY" == "1" && -f "$ROOT/compose/docker-compose.observability.yml" ]]; then
  COMPOSE_FILES+=(-f "$ROOT/compose/docker-compose.observability.yml")
  PROFILE_ARGS+=(--profile observability)
fi

if [[ "$WITH_GLITCHTIP" == "1" && -f "$ROOT/compose/docker-compose.glitchtip.yml" ]]; then
  COMPOSE_FILES+=(-f "$ROOT/compose/docker-compose.glitchtip.yml")
  PROFILE_ARGS+=(--profile "glitchtip-${STACK}")
  if [[ "$STACK" == "prod" && -f "$ROOT/compose/docker-compose.glitchtip-prod-labels.yml" ]]; then
    COMPOSE_FILES+=(-f "$ROOT/compose/docker-compose.glitchtip-prod-labels.yml")
  fi
fi

# Confirmation gate. CONFIRM=yes env var skips the prompt (for CI / scripted use).
if [[ "${CONFIRM:-}" != "yes" ]]; then
  echo "This will DELETE all named volumes (Postgres + Valkey data) for STACK=$STACK."
  echo "Type 'yes' to continue, anything else to abort."
  read -r -p "> " confirmation
  if [[ "$confirmation" != "yes" ]]; then
    echo "Aborted."
    exit 0
  fi
fi

exec docker compose "${COMPOSE_FILES[@]}" "${PROFILE_ARGS[@]}" down -v "$@"
