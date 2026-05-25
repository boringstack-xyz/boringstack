# PromQL cheatsheet

Quick reference for querying Prometheus from Grafana's Explore tab or the dashboards. Targeted at the metrics the observability overlay ships out of the box: Traefik, Postgres-exporter, Node-exporter, Prometheus itself.

## Basics

| Query | Meaning |
|---|---|
| `up` | 1 if scrape target is reachable, 0 if not. Easiest health check. |
| `up{job="traefik"}` | Same, filtered to one job. |
| `up == 0` | Only the targets that are currently down. |
| `rate(metric[5m])` | Per-second rate of `metric` averaged over 5 minutes. Use this on counters. |
| `increase(metric[1h])` | Total increase over the last hour. |
| `sum by (label) (metric)` | Aggregate `metric` grouped by `label`. |
| `histogram_quantile(0.95, sum(rate(metric_bucket[5m])) by (le))` | p95 from a histogram bucket. |

## Traefik (router + service metrics)

```promql
# Requests per second, per Traefik service (api-dev, ui-dev, glitchtip-web, ...)
sum by (service) (rate(traefik_service_requests_total[5m]))

# 5xx rate per service
sum by (service) (rate(traefik_service_requests_total{code=~"5.."}[5m]))

# 5xx as a fraction of all requests (last 5m)
  sum by (service) (rate(traefik_service_requests_total{code=~"5.."}[5m]))
/ sum by (service) (rate(traefik_service_requests_total[5m]))

# Request duration p95 per service
histogram_quantile(0.95,
  sum by (service, le) (rate(traefik_service_request_duration_seconds_bucket[5m])))

# Open connections per entrypoint
sum by (entrypoint) (traefik_entrypoint_open_connections)
```

## Postgres (postgres-exporter)

```promql
# Is Postgres up?
pg_up

# Active connections by state
sum by (state) (pg_stat_activity_count)

# Slowest queries (per-DB transaction time)
rate(pg_stat_database_xact_commit{datname!~"template.*|postgres"}[5m])

# Cache hit ratio (closer to 1.0 = better)
  rate(pg_stat_database_blks_hit[5m])
/ (rate(pg_stat_database_blks_hit[5m]) + rate(pg_stat_database_blks_read[5m]))

# Replication lag (if any standby)
pg_replication_lag_seconds
```

## Node / host (node-exporter)

```promql
# CPU usage percentage (non-idle)
100 - avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]) * 100)

# Memory used (% of total)
(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100

# Disk space used on the root filesystem (%)
100 * (1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"})

# Outbound network throughput (bytes/sec) per interface
sum by (device) (rate(node_network_transmit_bytes_total{device!~"lo|docker.*"}[5m]))
```

## Container resource usage (when cAdvisor is added)

```promql
# Memory per container vs limit (1.0 = at limit)
container_memory_usage_bytes / container_spec_memory_limit_bytes

# CPU per container (cores)
rate(container_cpu_usage_seconds_total[5m])
```

## Common patterns

**"Top N noisiest services":**
```promql
topk(5, sum by (service) (rate(traefik_service_requests_total[5m])))
```

**"Error rate over time, alert if > 1% sustained":**
```promql
  sum by (service) (rate(traefik_service_requests_total{code=~"5.."}[5m]))
/ sum by (service) (rate(traefik_service_requests_total[5m]))
> 0.01
```

**"Container restarted in the last hour":**
```promql
changes(container_start_time_seconds[1h]) > 0
```

## Where to put queries

- **Grafana Explore** for one-off investigation.
- **Grafana Dashboards** for things you'll read repeatedly.
- **Prometheus alerting rules** (`compose/prometheus/`) for "wake me up if".

Related: [LogQL cheatsheet](logql-cheatsheet.md), [observability-optional.md](observability-optional.md).
