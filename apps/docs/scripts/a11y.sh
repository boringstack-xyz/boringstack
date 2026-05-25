#!/usr/bin/env bash
# Run axe-core against a representative set of pages from dist/.
# Usage: pnpm a11y
# Requires: pnpm build first; @axe-core/cli + http-server as devDeps.
set -euo pipefail

PORT="${A11Y_PORT:-4399}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist"

if [ ! -d "$DIST" ]; then
  echo "dist/ missing. Run 'pnpm build' first." >&2
  exit 1
fi

pnpm exec http-server "$DIST" -p "$PORT" -s -c-1 >/dev/null 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

# Wait for the server.
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PORT/" >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done

# Representative URLs: one per template type. axe-core failures exit non-zero.
URLS=(
  "http://127.0.0.1:$PORT/"
  "http://127.0.0.1:$PORT/quickstart/"
  "http://127.0.0.1:$PORT/architecture/why-boringstack/"
  "http://127.0.0.1:$PORT/architecture/decisions/"
  "http://127.0.0.1:$PORT/recipes/add-stripe/"
  "http://127.0.0.1:$PORT/reference/cost-methodology/"
  "http://127.0.0.1:$PORT/reference/glossary/"
  "http://127.0.0.1:$PORT/404.html"
)

pnpm exec axe \
  --exit \
  --tags wcag2a,wcag2aa,wcag21aa \
  "${URLS[@]}"
