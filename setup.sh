#!/usr/bin/env bash
# One-shot setup helper. Bootstraps `compose/.env` from `.env.example`,
# generates a GlitchTip secret if needed, makes scripts executable, and
# (optionally) runs `./dev.sh up -d --build` against the dev profile.
#
# Idempotent: safe to re-run. Skips any step that's already done.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA="$ROOT/infra/compose"

if [[ ! -d "$INFRA" ]]; then
  echo "[setup] ERROR: $INFRA is missing. Clone https://github.com/boringstack-xyz/boringstack" >&2
  exit 1
fi

echo "[setup] Making shell scripts executable…"
chmod +x "$INFRA/compose/dev.sh" "$INFRA"/scripts/*.sh "$ROOT"/scripts/stack-*.sh 2>/dev/null || true

if [[ ! -f "$INFRA/compose/.env" ]]; then
  echo "[setup] Creating compose/.env from .env.example…"
  cp "$INFRA/compose/.env.example" "$INFRA/compose/.env"
fi

if ! grep -q "^GLITCHTIP_SECRET_KEY=." "$INFRA/compose/.env"; then
  echo "[setup] Generating GLITCHTIP_SECRET_KEY…"
  printf "\nGLITCHTIP_SECRET_KEY=%s\n" "$(openssl rand -base64 50 | tr -d '\n')" \
    >> "$INFRA/compose/.env"
fi

case "${1:-}" in
  --up|--start)
    echo "[setup] Starting dev stack…"
    (cd "$INFRA/compose" && ./dev.sh up -d --build)
    ;;
  *)
    echo
    echo "[setup] Done. Next:"
    echo "  cd infra/compose/compose && ./dev.sh up -d --build"
    echo "  open http://localhost:3001"
    echo "  sign in as demo@example.com / password123"
    ;;
esac
