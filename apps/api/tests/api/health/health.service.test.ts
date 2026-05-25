import { describe, expect, test } from "bun:test";

import { healthService } from "../../../src/api/health/health.service";

describe("healthService.readiness", () => {
  test("returns a structured outcome with checks + an isFatal flag", async () => {
    const outcome = await healthService.readiness();

    expect(typeof outcome.isFatal).toBe("boolean");
    expect(outcome.report).toBeDefined();
    expect(Array.isArray(outcome.report.checks)).toBe(true);
    expect(outcome.report.checks.length).toBeGreaterThan(0);
  });

  test("each check has a name, status, and non-negative latencyMs", async () => {
    const { report } = await healthService.readiness();

    for (const check of report.checks) {
      expect(typeof check.name).toBe("string");
      expect(check.name.length).toBeGreaterThan(0);
      expect(["ok", "down", "degraded"]).toContain(check.status);
      expect(check.latencyMs).toBeGreaterThanOrEqual(0);
    }
  });

  test("isFatal is false when every check is ok or degraded", async () => {
    const { isFatal, report } = await healthService.readiness();

    const allHealthy = report.checks.every(
      (check) => check.status === "ok" || check.status === "degraded"
    );

    if (allHealthy) {
      expect(isFatal).toBe(false);
    }
  });

  test("isFatal is true when at least one check is down", async () => {
    const { isFatal, report } = await healthService.readiness();

    const anyDown = report.checks.some((check) => check.status === "down");

    if (anyDown) {
      expect(isFatal).toBe(true);
    }
  });

  test("report.status is a string matching one of the canonical statuses", async () => {
    const { report } = await healthService.readiness();

    expect(typeof report.status).toBe("string");
    expect(["ok", "degraded", "down"]).toContain(report.status);
  });
});
