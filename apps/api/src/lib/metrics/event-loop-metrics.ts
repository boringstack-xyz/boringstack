import { performance } from "node:perf_hooks";
import { Gauge } from "prom-client";

import { metricsRegistry } from "./registry";

/*
 * Event Loop Utilization (ELU).
 *
 * Matteo Collina's argument (and the wider Node.js community's): event
 * loop lag is *the* leading indicator of a Node service's health,
 * because CPU and memory don't tell you whether the loop can actually
 * dispatch callbacks. Lag (already collected by `collectDefaultMetrics`
 * as `nodejs_eventloop_lag_*_seconds`) measures *how late* callbacks
 * run. ELU goes one step further: it measures *how saturated* the loop
 * is, on a 0.0–1.0 scale.
 *
 *   - 0.0  → loop idle (no JS executing, only waiting on I/O)
 *   - 0.5  → loop is busy half the time
 *   - 1.0  → loop is fully saturated, no headroom
 *
 * Sustained >0.9 means the next burst will tip you into queueing
 * requests. Use as a paging signal alongside lag p99.
 *
 * `eventLoopUtilization()` is cumulative since process start; we diff
 * against the previous sample on each scrape so the gauge reflects
 * the *interval* utilisation, not the all-time average.
 */
let previousElu = performance.eventLoopUtilization();

export const nodejsEventLoopUtilization = new Gauge({
  name: "nodejs_eventloop_utilization",
  help: "Event loop utilization since the previous scrape (0.0–1.0). >0.9 sustained = no headroom.",
  registers: [metricsRegistry],
  collect() {
    const next = performance.eventLoopUtilization(previousElu);

    this.set(next.utilization);

    previousElu = performance.eventLoopUtilization();
  },
});
