import { now } from "../../lib/time/now";
import type {
  IReadinessCheck,
  IReadinessReport,
  ReadinessStatus,
} from "./health.types";

export const rollupStatus = (statuses: ReadinessStatus[]): ReadinessStatus => {
  if (statuses.includes("down")) {
    return "down";
  }

  if (statuses.includes("degraded")) {
    return "degraded";
  }

  return "ok";
};

/**
 * Runs the supplied set of checks in parallel and rolls them up into a
 * single readiness report. Pure function — useful for unit tests with
 * stubbed checks. The aggregator builds the env-dependent check list
 * and delegates here.
 */
export const runChecks = async (
  checks: IReadinessCheck[]
): Promise<IReadinessReport> => {
  const results = await Promise.all(checks.map(async (check) => check.run()));

  return {
    status: rollupStatus(results.map((result) => result.status)),
    timestamp: now(),
    checks: results,
  };
};

export const isReadinessFatal = (report: IReadinessReport): boolean =>
  report.status === "down";
