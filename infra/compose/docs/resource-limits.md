# Resource limits

Every service in `docker-compose.yml` declares both `limits` and `reservations` under `deploy.resources`. The defaults are sized for the dominant cheap-VPS target: **4 vCPU / 8 GB RAM** (e.g. a Hetzner CCX13 / DigitalOcean basic). All values are env-var-driven — override in `compose/.env` to fit your host.

## Why limits matter

A container without limits can consume the whole host. On a single-host setup that means one runaway query, one memory leak, one DoS, and Postgres gets OOM-killed — taking the whole stack with it. Limits give the kernel something to enforce _before_ the host falls over.

Reservations are softer: they tell the scheduler "this much must be available before starting", and make resource exhaustion show up at boot rather than mid-flight under load.

## Default budget

| Service     | CPU limit | RAM limit | CPU reserved | RAM reserved | Why                                 |
| ----------- | --------: | --------: | -----------: | -----------: | ----------------------------------- |
| postgres    |       1.0 |      512M |         0.25 |         128M | Hungry; primary state holder        |
| valkey      |       0.5 |      256M |          0.1 |          64M | In-memory; only as big as your data |
| traefik     |       0.5 |      256M |          0.1 |          64M | Light at this scale                 |
| api-migrate |       0.5 |      512M |            — |            — | One-shot; ephemeral                 |
| api-dev     |       1.5 |        1G |         0.25 |         256M | Bun + watcher + bind-mount = heavy  |
| ui-dev      |       1.5 |        1G |         0.25 |         256M | Vite + HMR = heavy                  |
| api (prod)  |       1.0 |      512M |         0.25 |         128M | Compiled, lean                      |
| ui (prod)   |       0.5 |      128M |          0.1 |          32M | Static nginx — almost free          |

**Sum (dev profile, base)**: ~5.5 vCPU limit, ~3.6G memory limit. CPU limits oversubscribe deliberately — they cap _peak_, not _steady-state_; the scheduler shares cycles when nobody's saturated.

**Sum (prod profile, base)**: ~3.5 vCPU limit, ~1.7G memory limit. Plenty of headroom on a 4-vCPU / 8G host for the data services and OS.

## Default-on overlays

Observability + GlitchTip are on by default. Their budgets:

| Service           | CPU limit | RAM limit | Why                                                   |
| ----------------- | --------: | --------: | ----------------------------------------------------- |
| prometheus        |       0.5 |      512M | TSDB; retention-driven                                |
| alertmanager      |      0.25 |      128M | Tiny; routes rules to receivers                       |
| grafana           |       0.5 |      512M | UI + provisioning; query workload                     |
| loki              |       0.5 |      512M | Log store; retention-driven                           |
| promtail          |      0.25 |      128M | Sidecar tailer                                        |
| postgres-exporter |       0.1 |       64M | Polls Postgres                                        |
| node-exporter     |       0.1 |       64M | Reads /proc and /sys                                  |
| glitchtip-web     |       1.0 |      512M | Django + uWSGI; ingest + UI                           |
| glitchtip-worker  |       1.0 |      512M | Celery + Beat; ingest, alerts, scheduled jobs         |

**Overlay sum**: ~4.2 vCPU limit, ~2.9G memory limit.

**Grand total (default dev boot)**: ~9.7 vCPU peak, ~6.5G memory ceiling.

This fits a 4-vCPU / 8G host comfortably (memory is the constraint to watch — leave at least 1G headroom for the OS + Docker). On a 2-vCPU / 4G box, disable the overlays:

```bash
WITH_OBSERVABILITY=0 WITH_GLITCHTIP=0 ./dev.sh up -d
```

## Boot expectations

Single-host cold start, default dev stack:

- **First boot ever** (volumes empty): 60–120s. GlitchTip dominates — Django migrations against a fresh database take 30–60s, then superuser + org + projects seeding adds another 5–10s. Everything else is healthy in <20s.
- **Warm boot** (volumes populated): 15–30s. Postgres ready in ~3s, Valkey in ~2s, api-migrate runs Drizzle drift check (fast on a healthy schema), api-dev + ui-dev compile in 5–10s. Grafana provisioning and Loki schema init add a few seconds.
- **Image pulls**: subtract from "first ever" — pulling all images on a fresh `docker pull` takes 1–3 minutes depending on network. Subsequent boots reuse the layers.

If steady-state cold boot exceeds 2 minutes on a 4-vCPU/8G host, check `docker compose logs glitchtip-web` for a slow migration step or `docker system df` for a near-full overlay storage driver.

## How `deploy.resources` interacts with plain `docker compose`

Compose v2 honors `deploy.resources.limits.{cpus,memory}` and `reservations.{cpus,memory}` _for plain `docker compose up`_ — this is **not** Swarm-only anymore. The Swarm-only directives are `deploy.replicas`, `deploy.update_config`, and `deploy.restart_policy`; we don't use those.

You can confirm limits are applied:

```bash
docker stats --no-stream
```

Each row's `MEM USAGE / LIMIT` should reflect the budget you set, not the host total.

## Sizing for a different host

If you're on a **2-vCPU / 4 GB** box: halve the API/UI limits (`API_DEV_LIMITS_MEMORY=512M`, `UI_DEV_LIMITS_MEMORY=512M`, `API_LIMITS_MEMORY=256M`); leave Postgres alone unless your dataset is small.

If you're on an **8-vCPU / 16 GB** box: double Postgres (`POSTGRES_LIMITS_MEMORY=1G`, `POSTGRES_LIMITS_CPUS=2.0`) before scaling anything else — Postgres benefits most from extra RAM via the page cache.

If you're running multiple replicas of `api` (production load-balanced), divide the per-replica budget by the replica count; the total fleet budget stays the same.

## Override surface

All knobs are in `compose/.env.example` under the **Resource budgets** section, commented out (the defaults in `docker-compose.yml` apply when they're unset). Uncomment and edit any subset.

## Caveats

- **CPU limits can throttle latency-sensitive work.** If you see request p99 spikes that disappear when you raise the limit, the limit was the cause. Inspect with `docker stats` (`CPU %`) — sustained 100% means you're throttled.
- **Memory limits are hard.** Hit the limit and the kernel sends `OOMKilled`. Watch for it in `docker compose ps` (Status column).
- **`reservations.cpus` is honored at scheduling time, not at runtime.** It guarantees a service can _start_, not that it gets a CPU share against contention. Use `cpu_shares` or `cpus` directly if you need runtime weighting.

## Related

- `compose/docker-compose.yml` — where the budgets live, under each service's `deploy.resources`.
- `compose/.env.example` — the override surface.
- `docs/observability.md` — Grafana dashboard for live `cpu`/`memory` per service via cAdvisor.
