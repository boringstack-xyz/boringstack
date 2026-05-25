# LogQL cheatsheet

Quick reference for querying Loki from Grafana's Explore tab. The Promtail config ships every container log to Loki with these labels:

- `compose_project` — always `ai-starter-infra`
- `compose_service` — the service name (`api-dev`, `ui-dev`, `postgres`, `traefik`, `glitchtip-web`, `glitchtip-worker`, etc.)
- `container` — the container name (`ai-starter-infra-api-dev-1`)

## Basics

| Query | Meaning |
|---|---|
| `{compose_service="api-dev"}` | All logs from one service. |
| `{compose_service=~"api-dev\|ui-dev"}` | Regex match across services. |
| `{compose_service="api-dev"} \|= "error"` | Filter for the literal substring "error". |
| `{compose_service="api-dev"} \|~ "(?i)error\|warn"` | Case-insensitive regex. |
| `{compose_service="api-dev"} != "GET /health"` | Exclude noisy lines. |
| `{compose_service="api-dev"} \| json` | Parse the log line as JSON; subsequent filters can refer to extracted fields. |
| `{compose_service="api-dev"} \| json \| level="error"` | Use a JSON field as a filter. |
| `count_over_time({compose_service="api-dev"}[5m])` | Number of lines per 5-minute window. |
| `rate({compose_service="api-dev"} \|= "error" [5m])` | Per-second rate of error lines. |

## Common patterns

**"Show me everything from one service in chronological order":**
```logql
{compose_service="api-dev"}
```

**"All errors across all services, last 1h":**
```logql
{compose_project="ai-starter-infra"} |~ "(?i)error"
```

**"Errors as a numeric series for graphing":**
```logql
sum by (compose_service) (rate({compose_project="ai-starter-infra"} |~ "(?i)error" [5m]))
```

**"Filter API logs by Pino JSON `level`":**
```logql
{compose_service="api-dev"} | json | level=~"error|fatal"
```

**"Group Traefik 5xx responses by router":**
```logql
sum by (router) (
  rate(
    {compose_service="traefik"}
    | json
    | code=~"5.."
    [5m]
  )
)
```

**"GlitchTip ingest errors":**
```logql
{compose_service="glitchtip-worker"} |~ "(?i)ingest|task_error"
```

**"Postgres slow queries (logged by Postgres when above threshold)":**
```logql
{compose_service="postgres"} |~ "duration: [0-9]{4,}"
```

**"What did container X log right before it crashed?":**
```logql
# Combined with Grafana's time-range picker, scope to the 30s before the
# restart event in Prometheus (changes(container_start_time_seconds[5m]) > 0).
{container="ai-starter-infra-api-dev-1"}
```

## Useful operators

- `|=` literal substring contains
- `!=` literal substring NOT contains
- `|~` regex match (RE2)
- `!~` regex NOT match
- `| json` parse as JSON (then filter on extracted fields)
- `| logfmt` parse logfmt (key=value pairs)
- `| pattern "<request> <status>"` parse with a positional pattern
- `| unpack` flatten Loki-promtail packaged labels

## Time selectors

- `[5m]` last 5 minutes (in `rate`, `count_over_time`, …)
- `[$__interval]` the Grafana panel's auto-interval — use when building dashboards

## Putting it together

```logql
# Top 10 distinct error messages emitted by the API over the last hour
topk(10,
  count_over_time(
    {compose_service="api-dev"} | json | level=~"error|fatal" [1h]
  )
)
```

Related: [PromQL cheatsheet](promql-cheatsheet.md), [observability-optional.md](observability-optional.md).
