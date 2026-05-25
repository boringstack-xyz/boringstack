#!/usr/bin/env bash
# GlitchTip prod bootstrap — run after the first prod boot to apply Django
# migrations and create the initial superuser. Dev users don't need this:
# `glitchtip-dev` runs with GLITCHTIP_SUPERUSER_* envs and the image's
# entrypoint handles migration + superuser creation automatically.
#
# Usage:
#   STACK=prod ./scripts/compose-up.sh         # bring up prod stack
#   ./scripts/glitchtip-bootstrap.sh           # one-shot setup
#
# Re-running is safe: migrations are idempotent and the superuser create
# fails-without-error if the email already exists.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/compose"

if [[ -f .env ]]; then
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
fi

: "${GLITCHTIP_SUPERUSER_EMAIL:?GLITCHTIP_SUPERUSER_EMAIL is required in compose/.env}"
: "${GLITCHTIP_SUPERUSER_PASSWORD:?GLITCHTIP_SUPERUSER_PASSWORD is required in compose/.env}"

WEB_CONTAINER="$(docker compose ps -q glitchtip-web 2>/dev/null || true)"
if [[ -z "$WEB_CONTAINER" ]]; then
  echo "[bootstrap] ERROR: glitchtip-web container is not running. Bring it up first:" >&2
  echo "            WITH_GLITCHTIP=1 ./scripts/compose-up.sh" >&2
  exit 1
fi

echo "[bootstrap] Applying Django migrations..."
docker compose exec -T glitchtip-web ./manage.py migrate --noinput

echo "[bootstrap] Ensuring superuser '${GLITCHTIP_SUPERUSER_EMAIL}' exists..."
docker compose exec -T \
  -e DJANGO_SUPERUSER_EMAIL="$GLITCHTIP_SUPERUSER_EMAIL" \
  -e DJANGO_SUPERUSER_PASSWORD="$GLITCHTIP_SUPERUSER_PASSWORD" \
  glitchtip-web ./manage.py createsuperuser --noinput \
  || echo "[bootstrap] (superuser may already exist — that's fine)"

echo "[bootstrap] Done. Visit ${GLITCHTIP_DOMAIN:-https://glitchtip.example.com}"
