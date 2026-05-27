import { Elysia } from "elysia";

import { httpRequestDurationSeconds, httpRequestsTotal } from "../lib/metrics";

const METRICS_PATH = "/metrics";

/**
 * Per-request Prometheus observer. Starts a timer in `onRequest` and
 * records the labelled outcome in `onAfterResponse`. Path is folded
 * to the matched route (`/api/v1/users/:id` instead of
 * `/api/v1/users/abc-123`) so the cardinality stays bounded — raw
 * URIs would explode the metric series within minutes of real
 * traffic.
 *
 * The `/metrics` endpoint itself is excluded so Prometheus's own
 * scrape requests don't show up in the histogram and skew its own
 * P99.
 */
export const metricsObserver = new Elysia({ name: "metrics-observer" })
  .derive({ as: "global" }, () => ({
    metricsStart: process.hrtime.bigint(),
  }))
  .onAfterResponse(
    { as: "global" },
    ({ request, route, set, metricsStart }) => {
      if (route === METRICS_PATH) {
        return;
      }

      if (typeof metricsStart !== "bigint") {
        return;
      }

      const status = String(set.status ?? 200);
      const labels = {
        method: request.method,
        route,
        status,
      };

      const durationSeconds =
        Number(process.hrtime.bigint() - metricsStart) / 1_000_000_000;

      httpRequestsTotal.inc(labels);
      httpRequestDurationSeconds.observe(labels, durationSeconds);
    }
  );
