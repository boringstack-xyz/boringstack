import { collectDefaultMetrics, Registry } from "prom-client";

/**
 * Global Prometheus registry. One instance per process — every metric
 * we define attaches itself to this registry, and `/metrics` exposes
 * its full contents on each scrape.
 *
 * `collectDefaultMetrics` adds Node.js runtime metrics (event loop
 * lag, GC, heap, file descriptors, process CPU/memory). Those are
 * usually the first thing an operator wants when an incident hits,
 * and they cost essentially nothing.
 *
 * The registry is initialised once at module load. Subsequent imports
 * of `metricsRegistry` share the same instance.
 */
export const metricsRegistry = new Registry();

metricsRegistry.setDefaultLabels({
  app: "boringstack-api",
});

collectDefaultMetrics({ register: metricsRegistry });
