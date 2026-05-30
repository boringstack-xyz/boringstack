#!/usr/bin/env bash
# Auto-wire WEB_PUSH_VAPID_* + VITE_VAPID_PUBLIC_KEY for the dev stack.
#
# What it does:
#   1. Skips entirely if WEB_PUSH_VAPID_PUBLIC is already set in
#      compose/.env (operator override / previous run).
#   2. Runs apps/api/scripts/codegen/vapid-generate.ts inside the running
#      api-dev container to produce a keypair plus subject.
#   3. Writes the three vars into compose/.env, then forces api-dev +
#      ui-dev to recreate so the new env reaches both runtimes.
#
# Idempotent. Safe to invoke from dev.sh on every detached `up` — does
# nothing once the keys are wired.
#
# Usage:
#   ./scripts/dev-vapid-init.sh           # foreground, verbose
#   ./scripts/dev-vapid-init.sh --quiet   # background-friendly, less output
#
# VAPID public keys ship in the browser bundle and are not secrets. The
# private half stays on the api; treat it like any other application
# secret in compose/.env (never commit a real prod value).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_DIR="$ROOT/compose"
ENV_FILE="$COMPOSE_DIR/.env"

QUIET=0
if [[ "${1:-}" == "--quiet" ]]; then
  QUIET=1
fi

log() {
  if [[ "$QUIET" == "0" ]]; then
    echo "[vapid-init] $*"
  fi
}

warn() {
  echo "[vapid-init] $*" >&2
}

cd "$COMPOSE_DIR"

touch "$ENV_FILE"
CUR_PUBLIC="$(grep -E '^WEB_PUSH_VAPID_PUBLIC=' "$ENV_FILE" | tail -n1 | sed 's/^WEB_PUSH_VAPID_PUBLIC=//' || true)"
if [[ -n "$CUR_PUBLIC" ]]; then
  log "WEB_PUSH_VAPID_PUBLIC already set — leaving as-is."
  exit 0
fi

PROJECT_NAME="$(docker compose config --format json 2>/dev/null \
  | grep -o '"name":[[:space:]]*"[^"]*"' | head -n1 \
  | sed 's/.*"name":[[:space:]]*"\([^"]*\)".*/\1/' \
  || true)"
PROJECT_NAME="${PROJECT_NAME:-$(basename "$COMPOSE_DIR")}"

API_CONTAINER="$(docker ps -q \
  --filter "label=com.docker.compose.project=${PROJECT_NAME}" \
  --filter "label=com.docker.compose.service=api-dev" \
  | head -n1)"

if [[ -z "$API_CONTAINER" ]]; then
  log "api-dev is not running — skipping VAPID auto-wire."
  exit 0
fi

log "Waiting for api-dev to be ready..."
DEADLINE=$(( $(date +%s) + 60 ))
while (( $(date +%s) < DEADLINE )); do
  if docker exec "$API_CONTAINER" sh -c 'test -d node_modules/web-push' >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if ! docker exec "$API_CONTAINER" sh -c 'test -d node_modules/web-push' >/dev/null 2>&1; then
  warn "api-dev didn't expose node_modules/web-push within 60s — skipping VAPID auto-wire."
  warn "Re-run later with: ./scripts/dev-vapid-init.sh"
  exit 0
fi

log "Generating VAPID keypair inside api-dev..."
OUTPUT="$(docker exec "$API_CONTAINER" bun scripts/codegen/vapid-generate.ts 2>/dev/null || true)"

if [[ -z "$OUTPUT" ]]; then
  warn "vapid-generate.ts returned no output."
  warn "Run manually: docker compose exec api-dev bun scripts/codegen/vapid-generate.ts"
  exit 0
fi

VAPID_PUBLIC=""
VAPID_PRIVATE=""
VAPID_SUBJECT=""
while IFS= read -r line; do
  case "$line" in
    WEB_PUSH_VAPID_PUBLIC=*) VAPID_PUBLIC="${line#WEB_PUSH_VAPID_PUBLIC=}" ;;
    WEB_PUSH_VAPID_PRIVATE=*) VAPID_PRIVATE="${line#WEB_PUSH_VAPID_PRIVATE=}" ;;
    WEB_PUSH_VAPID_SUBJECT=*) VAPID_SUBJECT="${line#WEB_PUSH_VAPID_SUBJECT=}" ;;
  esac
done <<< "$OUTPUT"

if [[ -z "$VAPID_PUBLIC" || -z "$VAPID_PRIVATE" || -z "$VAPID_SUBJECT" ]]; then
  warn "Could not parse all three VAPID values from generator output."
  exit 0
fi

# Dev default: use a localhost-shaped subject rather than the generator's
# `notifications@example.com` placeholder. Operator can edit later.
VAPID_SUBJECT="mailto:dev@localhost"

upsert_env_if_empty() {
  local key="$1" value="$2" file="$3"
  local cur
  cur="$(grep -E "^${key}=" "$file" | tail -n1 | sed "s/^${key}=//" || true)"
  if [[ -n "$cur" ]]; then
    log "$key already set — leaving as-is (operator override)."
    return
  fi
  if grep -qE "^${key}=" "$file"; then
    awk -v k="$key" -v v="$value" 'BEGIN{FS=OFS="="} $1==k {$0=k"="v} {print}' "$file" > "${file}.tmp" \
      && mv "${file}.tmp" "$file"
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$file"
  fi
}

log "Wiring VAPID keys in ${ENV_FILE#"$ROOT"/}"
upsert_env_if_empty WEB_PUSH_VAPID_PUBLIC "$VAPID_PUBLIC" "$ENV_FILE"
upsert_env_if_empty WEB_PUSH_VAPID_PRIVATE "$VAPID_PRIVATE" "$ENV_FILE"
upsert_env_if_empty WEB_PUSH_VAPID_SUBJECT "$VAPID_SUBJECT" "$ENV_FILE"

# Recreate api-dev + ui-dev so they pick up the new env at boot. Same
# rationale as glitchtip-fetch-dsn.sh: `docker compose restart` reuses
# the env that was interpolated when the container was first `up`-ed,
# so a forced recreate is required to re-read .env.
RECREATABLE=()
for svc in api-dev ui-dev; do
  cid="$(docker ps -q \
    --filter "label=com.docker.compose.project=${PROJECT_NAME}" \
    --filter "label=com.docker.compose.service=${svc}" \
    | head -n1)"
  if [[ -n "$cid" ]]; then
    RECREATABLE+=("$svc")
  fi
done

if (( ${#RECREATABLE[@]} > 0 )); then
  log "Recreating ${RECREATABLE[*]} to pick up VAPID env..."
  docker compose --profile dev up -d --force-recreate --no-deps "${RECREATABLE[@]}" \
    >/dev/null 2>&1 || warn "Recreate failed; restart api-dev + ui-dev manually."
fi

log "Done. Push channel is wired."
