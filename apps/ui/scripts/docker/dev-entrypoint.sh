#!/bin/sh
set -eu

# ui-dev bind-mounts source over /app and shadows node_modules with a named
# volume. On first boot the volume is empty; if the host still has a pnpm
# tree, Docker may copy that into the volume instead of the image install.
# Either way, vite must not run against an empty or pnpm layout — and `bun
# run` with default --install=auto will try to reinstall on every start,
# which loops forever under restart: unless-stopped.

if [ ! -x /opt/node_modules/.bin/vite ]; then
  echo "[ui-dev] ERROR: /opt/node_modules is missing — rebuild the image." >&2
  exit 1
fi

needs_seed=0
if [ ! -x node_modules/.bin/vite ]; then
  needs_seed=1
elif [ -d node_modules/.pnpm ] || [ -f node_modules/.modules.yaml ]; then
  needs_seed=1
fi

if [ "$needs_seed" -eq 1 ]; then
  echo "[ui-dev] Seeding node_modules from image (volume empty or stale pnpm tree)..."
  mkdir -p node_modules
  find node_modules -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  cp -a /opt/node_modules/. node_modules/
fi

exec "$@"
