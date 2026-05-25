#!/usr/bin/env bash
# Refuses to run `pnpm dev` on the host when the `ui-dev` compose
# container is already up. The container bind-mounts the apps/ui
# tree into /app, so a host-side dev process and a container-side one
# both touching the same source / cache directories race. Pick one.
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  exit 0
fi

if docker ps --format '{{.Names}}' 2>/dev/null \
  | grep -qE '^ai-starter-infra-ui-dev-[0-9]+$'; then
  cat >&2 <<'MSG'

──────────────────────────────────────────────────────────────────────
 The ui-dev compose container is running.

 You're about to start `pnpm dev` on the host. The container is
 already serving Vite on http://localhost:3001 via the bind-mounted
 source tree; a second dev server on the host fights it for ports
 and writes to the same .vite cache.

 Pick one:

   • Host dev:      cd ../../infra/compose/compose
                    ./dev.sh down
                    pnpm dev

   • Container dev: use docker; don't run `pnpm dev` on the host.
                    Logs: ./dev.sh logs -f ui-dev

──────────────────────────────────────────────────────────────────────
MSG
  exit 1
fi
