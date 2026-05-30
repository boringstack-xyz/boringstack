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

# OSC 8 hyperlink (https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda).
# Renders TEXT as a clickable link to URL in iTerm2, Terminal.app, Ghostty,
# WezTerm, VS Code, GNOME Terminal, Konsole, etc. Falls back to the URL on
# unsupported terminals (most modern terminals at least URL-detect plain
# http:// strings, so the link is still reachable).
osc8() {
  local url="$1" text="$2"
  printf '\033]8;;%s\033\\%s\033]8;;\033\\' "$url" "$text"
}

# Pretty-print "Name  http://...". 18-char left column accommodates the
# longest service name without wrapping.
row() {
  local name="$1" url="$2"
  printf '  %-18s%s\n' "$name" "$(osc8 "$url" "$url")"
}

# Read a `KEY=value` line out of an env file; empty string if absent.
read_env() {
  local key="$1" file="$2"
  if [[ -f "$file" ]]; then
    grep -E "^${key}=" "$file" | tail -n1 | sed "s/^${key}=//"
  fi
}

print_dev_urls() {
  local env_file="$INFRA/compose/.env"
  local with_obs with_glitch with_bullmq with_mailpit
  with_obs="$(read_env WITH_OBSERVABILITY "$env_file")"
  with_glitch="$(read_env WITH_GLITCHTIP "$env_file")"
  with_bullmq="$(read_env WITH_BULLMQ "$env_file")"
  with_mailpit="$(read_env WITH_MAILPIT "$env_file")"

  echo
  echo "BoringStack is up. Open these:"
  echo
  row "UI"            "http://localhost:7331"
  row "API"           "http://localhost:7330"
  row "API OpenAPI"   "http://localhost:7330/swagger"

  # Dev defaults: Mailpit + Bull-board are on unless explicitly disabled.
  [[ "$with_mailpit" != "0" ]] && row "Mailpit"     "http://localhost:8025"
  [[ "$with_bullmq"  != "0" ]] && row "Bull-board"  "http://localhost:7332"

  # Observability stack defaults on; opt out with WITH_OBSERVABILITY=0.
  if [[ "$with_obs" != "0" ]]; then
    row "Grafana"       "http://localhost:3010"
    row "Prometheus"    "http://localhost:9090"
    row "Alertmanager"  "http://localhost:9093"
  fi

  # GlitchTip defaults on; opt out with WITH_GLITCHTIP=0. Dev publishes
  # the web container on host port 8055 (Traefik is prod-only).
  [[ "$with_glitch" != "0" ]] && row "GlitchTip"    "http://localhost:8055"

  echo
  echo "Sign in as demo@example.com / password123."
  echo
}

case "${1:-}" in
  --up|--start)
    echo "[setup] Starting dev stack…"
    (cd "$INFRA/compose" && ./dev.sh up -d --build)
    print_dev_urls
    ;;
  *)
    echo
    echo "[setup] Done. Next:"
    echo "  cd infra/compose/compose && ./dev.sh up -d --build"
    echo "  open http://localhost:7331"
    echo "  sign in as demo@example.com / password123"
    ;;
esac
