# Dev environment

Read when starting the SPA in dev, switching between host and
container dev, or chasing stale-module / blank-page boots.

## Pick one runner

Two ways to run the SPA in dev — `bun run dev` on the host, or the
`ui-dev` compose container. **Pick one. Never both at once.**

The container bind-mounts the apps/ui tree into `/app` so source
edits hot-reload. A host-side Vite while the container's also running
fights it for port 7331 and writes to the same `.vite` cache —
symptoms range from stale modules to blank-page boots.

`bun run dev` runs `scripts/dev/preflight-host-dev.sh` first and refuses to
start when the `ui-dev` container is up. Follow the guidance in the
error message to switch sides cleanly.

## After touching `package.json` / `bun.lock`

- **Host:** run `bun install` inside `apps/ui`.
- **Container:** refresh its separate dependency volume using the same Compose
  wrapper and overlays, then restart Vite:

```bash
infra/compose/compose/dev.sh stop ui-dev
infra/compose/compose/dev.sh run --rm --no-deps ui-dev bun install --frozen-lockfile
infra/compose/compose/dev.sh up -d --no-deps ui-dev
```

The container's named dependency volume survives image rebuilds. Rebuilding an
image alone does not update that volume. Do not delete the database volumes to
repair frontend dependencies.

If only the host install changed Vite's lockfile hash, or a large rename left a
stale module graph, first try `infra/compose/compose/dev.sh restart ui-dev`.
`504 Outdated Optimize Dep` and a missing export that exists on disk are useful
signals to check the long-running development server before rerunning e2e.
