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
      /*
       * Every guard returns silently — `onAfterResponse` runs on the
       * tail of the response and any throw here bubbles up as an
       * unhandled rejection that the bun test runner treats as a
       * "between tests" abort, killing the entire suite. The metrics
       * counters are best-effort observability; missing one
       * data-point is fine, a dead test process is not.
       */
      if (route === METRICS_PATH) {
        return;
      }

      if (typeof route !== "string" || typeof request.method !== "string") {
        return;
      }

      if (typeof metricsStart !== "bigint") {
        return;
      }

      try {
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
      } catch {
        /*
         * Defensive belt-and-suspenders: prom-client validation
         * errors (cardinality overflow, label-set mismatch) must not
         * propagate out of the response hook.
         */
      }
    }
  );
