# Observability (metrics + logs)

A self-contained metrics + logs stack. **On by default** for `dev` and `prod` via `./dev.sh up`. Opt out with `WITH_OBSERVABILITY=0`.

The premise: you can't build muscle memory for a dashboard you've never seen until prod day-one. Running Grafana + Prometheus + Loki against your localhost traffic means by the time you ship, the panels are familiar — they show your real dev errors, your real request latencies, your real Postgres connections.

## What you get

| Service               | URL                   | Purpose                                        |
| --------------------- | --------------------- | ---------------------------------------------- |
| **Prometheus**        | http://localhost:9090 | metric storage + query                         |
| **Grafana**           | http://localhost:3010 | dashboards + Explore for both metrics and logs |
| **Alertmanager**      | http://localhost:9093 | routing for Prometheus alert rules             |
| **Loki**              | (internal only)       | log storage                                    |
| **Promtail**          | (internal only)       | ships container logs to Loki                   |
| **postgres-exporter** | (internal only)       | Postgres metrics for Prometheus                |
| **node-exporter**     | (internal only)       | host metrics for Prometheus                    |

Grafana on **:3010** to avoid clashing with the API on **:7330** and the UI on **:7331**.

## Start

```bash
./scripts/compose-up.sh        # observability is on by default
```

`dev.sh` merges `docker-compose.observability.yml` and adds `--profile observability` automatically.

To skip the overlay (e.g. on a constrained laptop):

```bash
WITH_OBSERVABILITY=0 ./scripts/compose-up.sh
```

Set `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` in `compose/.env` before exposing Grafana beyond localhost.

## What's wired up out of the box

**Prometheus scrape targets** (`compose/prometheus/prometheus.yml`):

- itself, alertmanager, traefik (`:8899` metrics entrypoint), postgres-exporter, node-exporter.

**Grafana datasources** (auto-provisioned from `compose/grafana/provisioning/datasources/`):

- Prometheus (default), Loki.

**Promtail** (`compose/promtail/promtail-config.yml`):

- Discovers all containers in the `ai-starter-infra` Compose project via the docker socket.
- Labels every line with `compose_service` (e.g. `api-dev`, `traefik`), `compose_project`, and `container`.
- Ships to Loki.

## Querying

- **Metrics** — open Grafana → Explore → Prometheus datasource. See [PromQL cheatsheet](promql-cheatsheet.md) for example queries (Traefik 5xx rate, request p95, host CPU, Postgres cache hit ratio).
- **Logs** — Grafana → Explore → Loki datasource. Start with `{compose_service="api-dev"}`. See [LogQL cheatsheet](logql-cheatsheet.md) for filters, parsing, and aggregation.

## Stop

```bash
./scripts/compose-down.sh      # tears down everything dev.sh brought up
```

`compose-down-clean.sh` (with confirmation prompt) wipes the Postgres + Valkey volumes; observability data lives in `prometheus_data`, `grafana_data`, `loki_data` — also wiped by `down -v`.

## Alerts

Prometheus alert rules ship in `compose/prometheus/rules.yml` (14 rules out of the box covering API errors/latency, Postgres, host disk/memory/CPU, Traefik). Alertmanager runs on `:9093` with env-driven receivers — set `ALERTMANAGER_SLACK_WEBHOOK_URL` (Slack or Discord with `/slack` suffix) and/or `ALERTMANAGER_WEBHOOK_URL` (generic JSON) in `compose/.env` to get pager output. Full walkthrough in [alerts.md](alerts.md).

## Adding dashboards

Drop dashboard JSON into `compose/grafana/provisioning/dashboards/` (you'll need to create the dir + a provisioner YAML for that path — Grafana's docs show the one-file pattern). Common starters:

- Node Exporter Full: ID `1860` (paste into Grafana → Dashboards → Import).
- Traefik 2 / Official: ID `17347`.
- Postgres Exporter: ID `9628`.
- Loki + Docker logs: build with Explore queries from the LogQL cheatsheet.

## On Kubernetes

This overlay is single-host. For a cluster, use kube-prometheus-stack + Loki via Helm instead.
