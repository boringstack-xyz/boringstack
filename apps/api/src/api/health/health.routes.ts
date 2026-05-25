import { now } from "../../lib/time/now";
import { Elysia } from "elysia";
import { healthService } from "./health.service";

/**
 * Liveness + readiness routes mounted at the root (no `/api/v1` prefix)
 * so k3s/k8s / load balancers can hit the conventional URLs.
 *
 * - `GET /` is the cheapest "is this even up" probe.
 * - `GET /health` is the conventional liveness probe.
 * - `GET /ready` runs the full readiness aggregator and returns 503 when
 *   any check is `down`. `degraded` still returns 200 (e.g. dev-mode noop
 *   email shouldn't pull a healthy API out of the LB).
 */
const healthRoutes = new Elysia()
  .get("/", () => ({ name: "boringstack-api", status: "ok" }), {
    detail: { tags: ["Health"], summary: "Root liveness ping" },
  })
  .get("/health", () => ({ status: "ok", timestamp: now() }), {
    detail: { tags: ["Health"], summary: "Liveness probe" },
  })
  .get(
    "/ready",
    async ({ set }) => {
      const { report, isFatal } = await healthService.readiness();

      if (isFatal) {
        set.status = 503;
      }

      return report;
    },
    {
      detail: {
        tags: ["Health"],
        summary: "Readiness probe (DB + Valkey + email when configured)",
        description:
          "Returns 200 when all checks are 'ok' or 'degraded'; 503 when any 'down'.",
      },
    }
  );

export default healthRoutes;
