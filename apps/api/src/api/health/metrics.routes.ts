import { Elysia, t } from "elysia";

import { metricsRegistry } from "../../lib/metrics";

/**
 * Prometheus scrape endpoint. Mounted at the root (no `/api/v1`
 * prefix) on the same plane as `/health` and `/ready` so the
 * observability stack can hit a stable URL without weaving auth or
 * versioning into its scrape config.
 *
 * The endpoint returns whatever metrics live on `metricsRegistry`:
 * Node defaults (event loop lag, GC, heap, FDs, process CPU/memory)
 * plus the HTTP counter/histogram populated by the
 * `metrics-observer` middleware.
 */
const metricsRoutes = new Elysia().get(
  "/metrics",
  async ({ set }) => {
    set.headers["content-type"] = metricsRegistry.contentType;

    return metricsRegistry.metrics();
  },
  {
    response: t.String(),
    detail: {
      tags: ["Health"],
      summary: "Prometheus scrape endpoint",
      description:
        "Plain-text Prometheus exposition format. Scraped by the observability overlay; no auth.",
    },
  }
);

export default metricsRoutes;
