import { describe, expect, test } from "bun:test";
import {
  isReadinessFatal,
  rollupStatus,
  runChecks,
} from "../../../src/api/health/health.runner";
import type {
  IReadinessCheck,
  IReadinessResult,
  ReadinessStatus,
} from "../../../src/api/health/health.types";

const fakeCheck = (
  name: string,
  status: ReadinessStatus,
  latencyMs = 1,
  message?: string
): IReadinessCheck => ({
  name,
  run: (): Promise<IReadinessResult> =>
    Promise.resolve({
      name,
      status,
      latencyMs,
      ...(message !== undefined && { message }),
    }),
});

describe("rollupStatus", () => {
  test("all ok → ok", () => {
    expect(rollupStatus(["ok", "ok"])).toBe("ok");
  });

  test("any degraded with no down → degraded", () => {
    expect(rollupStatus(["ok", "degraded", "ok"])).toBe("degraded");
  });

  test("any down dominates", () => {
    expect(rollupStatus(["ok", "degraded", "down"])).toBe("down");
    expect(rollupStatus(["down", "ok"])).toBe("down");
  });

  test("empty list → ok (vacuously true)", () => {
    expect(rollupStatus([])).toBe("ok");
  });
});

describe("runChecks", () => {
  test("rolls up all-ok results to ok", async () => {
    const report = await runChecks([
      fakeCheck("a", "ok"),
      fakeCheck("b", "ok"),
    ]);

    expect(report.status).toBe("ok");
    expect(report.checks).toHaveLength(2);
    expect(report.checks.every((check) => check.status === "ok")).toBe(true);
    expect(typeof report.timestamp).toBe("string");
  });

  test("a single down flips overall status to down", async () => {
    const report = await runChecks([
      fakeCheck("a", "ok"),
      fakeCheck("b", "down", 12, "boom"),
      fakeCheck("check", "ok"),
    ]);

    expect(report.status).toBe("down");
    const downCheck = report.checks.find((check) => check.name === "b");

    expect(downCheck?.message).toBe("boom");
  });

  test("degraded passes but is reflected in overall status", async () => {
    const report = await runChecks([
      fakeCheck("a", "ok"),
      fakeCheck("b", "degraded", 5, "noop email"),
    ]);

    expect(report.status).toBe("degraded");
  });

  test("runs checks in parallel, not sequentially", async () => {
    const start = Date.now();
    const slowOk = (name: string): IReadinessCheck => ({
      name,
      run: async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));

        return { name, status: "ok", latencyMs: 50 };
      },
    });

    await runChecks([slowOk("a"), slowOk("b"), slowOk("c")]);
    // sequential would be ~150ms; parallel ~50ms. Allow generous slack.
    expect(Date.now() - start).toBeLessThan(120);
  });
});

describe("isReadinessFatal", () => {
  test("only 'down' is fatal", () => {
    expect(
      isReadinessFatal({
        status: "down",
        timestamp: "x",
        checks: [],
      })
    ).toBe(true);
    expect(
      isReadinessFatal({
        status: "degraded",
        timestamp: "x",
        checks: [],
      })
    ).toBe(false);
    expect(
      isReadinessFatal({
        status: "ok",
        timestamp: "x",
        checks: [],
      })
    ).toBe(false);
  });
});
