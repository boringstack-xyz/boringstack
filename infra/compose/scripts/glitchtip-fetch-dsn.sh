#!/usr/bin/env bash
# Auto-wire SENTRY_DSN + VITE_SENTRY_DSN from GlitchTip into compose/.env.
#
# What it does:
#   1. Waits for the `glitchtip-web` container to be healthy.
#   2. Pulls the DSN for the auto-created `API` and `Frontend` projects
#      via `manage.py shell` (no API auth dance — talks to Django direct).
#   3. Writes / updates SENTRY_DSN and VITE_SENTRY_DSN in compose/.env.
#   4. Restarts api-dev + ui-dev so they pick up the new env on next request.
#
# Idempotent: skips writing if the .env values already match the live DSNs.
# Safe to invoke from dev.sh on every `up` — does nothing on subsequent
# runs once .env is wired.
#
# Usage:
#   ./scripts/glitchtip-fetch-dsn.sh         # foreground, verbose
#   ./scripts/glitchtip-fetch-dsn.sh --quiet # background-friendly, less output
#
# DSNs are public keys (they ship in the browser bundle), not secrets — safe
# to write to compose/.env even if that file is committed.

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
    echo "[glitchtip-dsn] $*"
  fi
}

warn() {
  echo "[glitchtip-dsn] $*" >&2
}

cd "$COMPOSE_DIR"

# Project name is fixed via docker-compose.yml's top-level `name:` directive.
# Don't hard-code that string — `docker compose config` is the source of
# truth (also handles COMPOSE_PROJECT_NAME overrides). Falls back to the
# directory name if config is unparseable for some reason.
PROJECT_NAME="$(docker compose config --format json 2>/dev/null \
  | grep -o '"name":[[:space:]]*"[^"]*"' | head -n1 \
  | sed 's/.*"name":[[:space:]]*"\([^"]*\)".*/\1/' \
  || true)"
PROJECT_NAME="${PROJECT_NAME:-$(basename "$COMPOSE_DIR")}"

# Resolve glitchtip-web by Docker compose labels rather than `docker compose
# ps -q`, because `ps` validates the service against the *loaded* compose
# files and the base docker-compose.yml doesn't define glitchtip-web — the
# overlay does. Label lookup is project-scoped and overlay-agnostic.
WEB_CONTAINER="$(docker ps -q \
  --filter "label=com.docker.compose.project=${PROJECT_NAME}" \
  --filter "label=com.docker.compose.service=glitchtip-web" \
  | head -n1)"

if [[ -z "$WEB_CONTAINER" ]]; then
  log "glitchtip-web is not running — skipping auto-wire."
  exit 0
fi

# GlitchTip Celery/Django boot takes ~30–60s on a cold start. Poll the
# container's `manage.py check --database default` until it succeeds — that
# proves migrations have applied and the ORM is reachable.
log "Waiting for glitchtip-web to be ready..."
DEADLINE=$(( $(date +%s) + 180 ))
while (( $(date +%s) < DEADLINE )); do
  if docker exec "$WEB_CONTAINER" ./manage.py check --database default >/dev/null 2>&1; then
    break
  fi
  sleep 3
done

if ! docker exec "$WEB_CONTAINER" ./manage.py check --database default >/dev/null 2>&1; then
  warn "glitchtip-web didn't become ready within 180s — skipping auto-wire."
  warn "Re-run later with: ./scripts/glitchtip-fetch-dsn.sh"
  exit 0
fi

# Fetch DSNs via the Django ORM. Two import paths are tried because GlitchTip
# moved its `projects` app between releases. The shell script prints
# `<ProjectName>=<dsn>` lines or `__missing__=<ProjectName>` if a project
# doesn't exist yet (it usually does — GLITCHTIP_DEFAULT_PROJECTS creates
# `API` and `Frontend` on first boot of an empty DB).
log "Fetching project DSNs from GlitchTip..."
PYTHON_PROBE=$(cat <<'PYEOF'
import sys
try:
    from apps.projects.models import Project
except Exception:
    try:
        from glitchtip.projects.models import Project
    except Exception:
        try:
            from projects.models import Project
        except Exception as e:
            sys.stderr.write(f"could not import Project model: {e}\n")
            sys.exit(2)

wanted = ["API", "Frontend"]
for name in wanted:
    p = Project.objects.filter(name=name).first()
    if not p:
        print(f"__missing__={name}")
        continue
    key = p.projectkey_set.first()
    if not key:
        print(f"__nokey__={name}")
        continue
    print(f"{name}={key.get_dsn()}")
PYEOF
)

OUTPUT="$(docker exec "$WEB_CONTAINER" ./manage.py shell -c "$PYTHON_PROBE" 2>/dev/null || true)"

if [[ -z "$OUTPUT" ]]; then
  warn "manage.py shell returned no output — model import probably failed."
  warn "Open an issue or run manually:"
  warn "  docker compose exec glitchtip-web ./manage.py shell"
  exit 0
fi

API_DSN=""
UI_DSN=""
while IFS= read -r line; do
  case "$line" in
    API=*) API_DSN="${line#API=}" ;;
    Frontend=*) UI_DSN="${line#Frontend=}" ;;
    __missing__=*) warn "GlitchTip project '${line#__missing__=}' not found — bootstrap may not have completed." ;;
    __nokey__=*) warn "GlitchTip project '${line#__nokey__=}' exists but has no key — odd, inspect manually." ;;
  esac
done <<< "$OUTPUT"

if [[ -z "$API_DSN" || -z "$UI_DSN" ]]; then
  warn "Could not resolve both DSNs (API=${API_DSN:-<missing>} UI=${UI_DSN:-<missing>})."
  warn "Re-run later once GlitchTip has finished its first-boot bootstrap."
  exit 0
fi

# Policy: only write when the .env value is currently empty / missing. A
# non-empty existing value is the operator's choice — they may have pointed
# the stack at hosted Sentry or a different GlitchTip instance, and the
# auto-wire shouldn't silently overwrite that. The trade-off: once a DSN is
# in place, this script never touches it again, even if it has gone stale
# (e.g. the GlitchTip Postgres volume was wiped). In that case clear the
# line in compose/.env and re-run; the script will repopulate it.
touch "$ENV_FILE"
CUR_API_DSN="$(grep -E '^SENTRY_DSN=' "$ENV_FILE" | tail -n1 | sed 's/^SENTRY_DSN=//' || true)"
CUR_UI_DSN="$(grep -E '^VITE_SENTRY_DSN=' "$ENV_FILE" | tail -n1 | sed 's/^VITE_SENTRY_DSN=//' || true)"

WROTE_ANY=0
upsert_env_if_empty() {
  local key="$1" value="$2" cur="$3" file="$4"
  if [[ -n "$cur" ]]; then
    log "$key already set — leaving as-is (operator override)."
    return
  fi
  if grep -qE "^${key}=" "$file"; then
    # Key is present but empty — replace the empty value in-place.
    awk -v k="$key" -v v="$value" 'BEGIN{FS=OFS="="} $1==k {$0=k"="v} {print}' "$file" > "${file}.tmp" \
      && mv "${file}.tmp" "$file"
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$file"
  fi
  WROTE_ANY=1
}

log "Wiring DSNs in ${ENV_FILE#"$ROOT"/}"
upsert_env_if_empty SENTRY_DSN "$API_DSN" "$CUR_API_DSN" "$ENV_FILE"
upsert_env_if_empty VITE_SENTRY_DSN "$UI_DSN" "$CUR_UI_DSN" "$ENV_FILE"

if [[ "$WROTE_ANY" == "0" ]]; then
  log "Both DSNs already set — nothing to do."
  exit 0
fi

# Recreate api-dev + ui-dev so they pick up the new env interpolation.
# `docker compose restart` is NOT enough: it stops + starts the existing
# container with the env block that was interpolated from .env when the
# container was first `up`-ed. Only `up -d --force-recreate` re-resolves
# the env at recreate time.
#
# Both services live in the base docker-compose.yml (profiles [dev] /
# [dev, smoke]), so no overlay is needed — `--profile dev` is enough.
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
  log "Recreating ${RECREATABLE[*]} to pick up the new DSNs..."
  if docker compose --profile dev up -d --no-deps --force-recreate "${RECREATABLE[@]}" >/dev/null 2>&1; then
    log "Recreated: ${RECREATABLE[*]}"
  else
    warn "Recreate failed — run manually:"
    warn "  docker compose --profile dev up -d --no-deps --force-recreate ${RECREATABLE[*]}"
  fi
else
  log "(api-dev / ui-dev not running — they'll read the new env on next up)"
fi

log "Done. Sentry / GlitchTip wiring is live."
