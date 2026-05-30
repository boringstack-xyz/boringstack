# Alerts

The default observability stack ships with Prometheus alert rules wired into Alertmanager. The rules cover the obvious failure modes — API 5xx spikes, Postgres unavailability, disk and memory pressure, Traefik down — and fan out through Alertmanager to whatever receiver you configure.

Without a configured receiver, alerts still fire and surface in Alertmanager's web UI at **`http://localhost:9093`** (dev) — useful for confirming the rules trigger as expected before you wire pager output. With a receiver set, they go to Slack, Discord, or any HTTP endpoint that speaks Alertmanager's webhook JSON.

## What rules ship by default

`compose/prometheus/rules.yml` defines four groups:

| Group | Alert | Severity | Fires when |
|---|---|---|---|
| `boringstack-api` | `ApiServerErrorsHigh` | page | API 5xx > 1% for 5min |
| | `ApiServerErrorsCritical` | page | API 5xx > 5% for 2min |
| | `ApiLatencyP95High` | warn | p95 latency > 1s for 10min |
| | `ApiUnreachable` | page | no API traffic recorded for 5min |
| `boringstack-database` | `PostgresDown` | page | postgres-exporter can't reach Postgres for 2min |
| | `PostgresConnectionsHigh` | warn | > 80% of `max_connections` for 5min |
| | `PostgresReplicationLagHigh` | warn | replication lag > 60s for 5min |
| `boringstack-host` | `DiskSpaceLow` | warn | filesystem < 10% free for 5min |
| | `DiskSpaceCritical` | page | filesystem < 5% free for 2min |
| | `MemoryPressureHigh` | warn | memory available < 10% for 10min |
| | `HostCpuSaturated` | warn | load5 / cores > 1.5 for 15min |
| | `NodeExporterDown` | warn | host metrics stale for 3min |
| `boringstack-edge` | `TraefikDown` | page | Traefik metrics endpoint unreachable for 2min |

Routing in Alertmanager re-notifies `severity=page` every hour and `severity=warn` every 12 hours, so warnings don't pager-spam while criticals stay loud.

## Wiring a receiver

Alertmanager itself doesn't support env-var substitution in its config, so the compose stack ships an `entrypoint.sh` that renders the receiver block from `ALERTMANAGER_*` env vars at container start. Set the env, restart the container, you're done.

### Slack

1. Create a Slack app + Incoming Webhook (https://api.slack.com/messaging/webhooks). Copy the URL — it looks like `https://hooks.slack.com/services/T.../B.../...`.
2. In `compose/.env`:
   ```env
   ALERTMANAGER_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
   ALERTMANAGER_SLACK_CHANNEL=#alerts
   ```
3. Restart the Alertmanager container:
   ```bash
   docker compose restart alertmanager
   ```
4. Test by visiting `http://localhost:9093` and sending a silence — or wait for a real alert to fire.

The default message template renders alert status, severity, component, summary, and description. Severity labels (`severity: page` / `severity: warn`) drive the re-notify cadence above.

### Discord

Discord accepts Slack-format payloads at a special `/slack` suffix on its webhook URL. Set the same env as Slack, just point it at Discord:

1. In Discord: `Server Settings → Integrations → Webhooks → New Webhook`. Copy the webhook URL.
2. **Append `/slack`** to the URL. Example: `https://discord.com/api/webhooks/123.../abc.../slack`.
3. In `compose/.env`:
   ```env
   ALERTMANAGER_SLACK_WEBHOOK_URL=https://discord.com/api/webhooks/.../slack
   ```
   (`ALERTMANAGER_SLACK_CHANNEL` is ignored by Discord — the channel is fixed when you create the webhook.)
4. Restart: `docker compose restart alertmanager`.

### Generic webhook (Alertmanager JSON)

For custom bridges (your own alerter service, n8n flows, PagerDuty's events-v2 endpoint via a translator, etc.), use the generic webhook receiver. It POSTs Alertmanager's [native JSON payload](https://prometheus.io/docs/alerting/latest/configuration/#webhook_config) — different from Slack's format.

```env
ALERTMANAGER_WEBHOOK_URL=https://your-bridge.example.com/alerts
```

You can set this **in addition to** the Slack one; alerts fan out to both receivers.

## Tuning thresholds

Edit `compose/prometheus/rules.yml`, then either `docker compose restart prometheus` (full reload) or `curl -X POST http://localhost:9090/-/reload` (hot reload — faster). The defaults assume a single-host stack; a busy app may push 4xx/5xx absolute counts above what the percentage-based alerts catch on a quiet baseline, so revisit after you've watched real traffic.

## Adding rules

Drop additional groups into `rules.yml` under `groups:`. Prometheus rescans on reload. Required fields per alert: `alert`, `expr`, `for` (optional duration debounce), `labels.severity`, `annotations.summary`. The existing rules are worked examples.

## Adding routes

Out of the box every alert lands in the single `default` receiver. To route specific labels elsewhere (e.g. `component=database` to a DBA channel, `component=edge` to ops), extend the `route.routes` block — but this requires moving away from the env-driven config, since multiple receivers means hardcoding URLs. The clean path:

1. Edit `compose/alertmanager/entrypoint.sh` directly (it's a small shell script — add `cat >> "$CFG" <<EOF` blocks for each new receiver).
2. Or graduate to a static `alertmanager.yml` that you maintain yourself, and remove the entrypoint script.

## Verifying alerts work

The fast end-to-end test:

```bash
# Trigger a fake firing alert via Alertmanager's API:
curl -XPOST http://localhost:9093/api/v2/alerts -H 'Content-Type: application/json' -d '[
  {
    "labels": {
      "alertname": "TestPing",
      "severity": "warn",
      "component": "manual-test"
    },
    "annotations": {
      "summary": "Manual ping from alerts.md",
      "description": "If this lands in your Slack/Discord/webhook, the receiver is wired correctly."
    }
  }
]'
```

The alert resolves automatically after `resolve_timeout` (5 minutes) since no further pings keep it firing.

## Related

- `compose/alertmanager/entrypoint.sh` — the config renderer; reads `ALERTMANAGER_*` env vars and produces the live config.
- `compose/prometheus/rules.yml` — the alert rule definitions.
- `compose/docker-compose.observability.yml` — Alertmanager service definition (env vars, ports, mounts).
- [Observability overview](observability.md) — the broader metrics + logs stack these alerts run inside of.
