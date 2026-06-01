#!/usr/bin/env bash
# Refuses to run `bun run dev` on the host when the `api-dev` compose
# container is already up. The container bind-mounts the apps/api
# tree into /app, so a host-side dev process and a container-side one
# both writing to the same node_modules / .cache directories races and
# corrupts both. Pick one: host or container — never both.
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  exit 0
fi

# Compose project name (from `name:` in docker-compose.yml) prefixes the
# service container name with a numeric suffix per replica.
if docker ps --format '{{.Names}}' 2>/dev/null \
  | grep -qE '^boringstack-infra-api-dev-[0-9]+$'; then
  cat >&2 <<'MSG'

──────────────────────────────────────────────────────────────────────
 The api-dev compose container is running.

 You're about to start `bun run dev` on the host, which writes to
 ./node_modules. The container also mounts this directory and would
 race the host's install — both end up corrupted.

 Pick one:

   • Host dev:      cd ../../infra/compose/compose
                    ./dev.sh down
                    bun run dev

   • Container dev: use docker; don't run `bun run dev` on the host.
                    Logs: ./dev.sh logs -f api-dev

──────────────────────────────────────────────────────────────────────
MSG
  exit 1
fi
