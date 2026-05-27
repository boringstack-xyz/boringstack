import { Counter, Histogram } from "prom-client";

import { metricsRegistry } from "./registry";

/**
 * Per-request HTTP metrics.
 *
 * The histogram doubles as a counter (sum of its buckets is the
 * request total), but the explicit counter keeps PromQL queries
 * readable for operators who just want "requests per second by
 * method + status."
 *
 * Buckets target the typical web-API distribution — 50 ms to a few
 * seconds. Anything past 10 s lands in the overflow bucket and is
 * usually a sign the request should be a job, not a sync call.
 */
export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total HTTP requests, labelled by method, route, and status code.",
  labelNames: ["method", "route", "status"] as const,
  registers: [metricsRegistry],
});

export const httpRequestDurationSeconds = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds, labelled by method, route, and status code.",
  labelNames: ["method", "route", "status"] as const,
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});
