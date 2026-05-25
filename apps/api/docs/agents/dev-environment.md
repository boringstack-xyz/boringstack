# Dev environment

Read when starting the API in dev, switching between host and container
dev, or chasing "missing module" errors.

## Pick one runner

Two ways to run the API in dev — `bun run dev` on the host, or the
`api-dev` compose container. **Pick one. Never both at once.**

The container bind-mounts the api-template tree into `/app` so source
edits hot-reload. A host-side `bun install` or `bun run dev` writing
to the same `./node_modules` while the container's running races and
corrupts both — the symptom is usually a "missing module" error that
goes away after `rm -rf node_modules && bun install`, then comes back
the next time someone restarts the wrong side.

`bun run dev` runs `scripts/dev/preflight-host-dev.sh` first and refuses
to start when the `api-dev` container is up. Use the guidance in the
error message to switch sides cleanly.

## After touching `package.json` / `bun.lock`

- **Host:** `bun install` (no special steps).
- **Container:** `./dev.sh up --build` rebuilds the image; the named
  `api_dev_node_modules` volume persists across rebuilds, so refresh
  it once with
  `docker volume rm ai-starter-infra_api_dev_node_modules` before the
  next `up`.

`node_modules` is baked into the image at build time, so the container
no longer runs `bun install` on every startup — cold starts are
seconds, not minutes.
