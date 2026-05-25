# Dev environment

Read when starting the SPA in dev, switching between host and
container dev, or chasing stale-module / blank-page boots.

## Pick one runner

Two ways to run the SPA in dev — `pnpm dev` on the host, or the
`ui-dev` compose container. **Pick one. Never both at once.**

The container bind-mounts the ui-template tree into `/app` so source
edits hot-reload. A host-side Vite while the container's also running
fights it for port 3001 and writes to the same `.vite` cache —
symptoms range from stale modules to blank-page boots.

`pnpm dev` runs `scripts/dev/preflight-host-dev.sh` first and refuses to
start when the `ui-dev` container is up. Follow the guidance in the
error message to switch sides cleanly.

## After touching `package.json` / `pnpm-lock.yaml`

- **Host:** `pnpm install` (no special steps).
- **Container:** `./dev.sh up --build` rebuilds the image; the named
  `ui_dev_node_modules` volume persists across rebuilds, so refresh
  it once with
  `docker volume rm ai-starter-infra_ui_dev_node_modules` before the
  next `up`.

`node_modules` is baked into the image at build time, so the
container no longer runs `pnpm install` on every startup.
