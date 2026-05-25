import { logger } from "../../config/logger";
import { runReadinessChecks } from "./health.aggregate";
import { isReadinessFatal } from "./health.runner";
import type { IReadinessOutcome } from "./health.types";

export class HealthService {
  async readiness(): Promise<IReadinessOutcome> {
    const report = await runReadinessChecks();
    const isFatal = isReadinessFatal(report);

    if (isFatal) {
      logger.warn("Readiness probe reported fatal status", {
        event: "readiness_fatal",
        checks: report.checks,
      });
    }

    return { report, isFatal };
  }
}

export const healthService = new HealthService();
