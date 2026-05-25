# Optional observability (metrics + logs)

A self-contained metrics + logs stack, gated behind a single env flag. Stays off by default — turn it on when you need it, leave it off when you don't.

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

Grafana on **:3010** to avoid clashing with the API on **:3000** and the UI on **:3001**.

## Start

```bash
WITH_OBSERVABILITY=1 ./scripts/compose-up.sh
```

The overlay merges automatically. `dev.sh` passes `--profile observability` along with whichever stack profile (`dev` or `prod`) you're using.

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

Use the same flag:

```bash
WITH_OBSERVABILITY=1 ./scripts/compose-down.sh
```

`compose-down-clean.sh` (with confirmation prompt) wipes the Postgres + Valkey volumes; observability data lives in `prometheus_data`, `grafana_data`, `loki_data` — also wiped by `down -v`.

## Adding alert rules

Drop YAML files into `compose/prometheus/rules/` and reference them in `prometheus.yml`. Alertmanager routing config lives in `compose/alertmanager/alertmanager.yml`. Recipes (Slack, email, PagerDuty) are in the Prometheus docs.

## Adding dashboards

Drop dashboard JSON into `compose/grafana/provisioning/dashboards/` (you'll need to create the dir + a provisioner YAML for that path — Grafana's docs show the one-file pattern). Common starters:

- Node Exporter Full: ID `1860` (paste into Grafana → Dashboards → Import).
- Traefik 2 / Official: ID `17347`.
- Postgres Exporter: ID `9628`.
- Loki + Docker logs: build with Explore queries from the LogQL cheatsheet.

## On Kubernetes

This overlay is single-host. For a cluster, use kube-prometheus-stack + Loki via Helm instead.
