import { describe, expect, test } from "bun:test";

import { metricsRegistry } from "../../../src/lib/metrics/registry";

describe("metricsRegistry", () => {
  test("exposes Node.js default runtime metrics", async () => {
    const output = await metricsRegistry.metrics();

    expect(output).toContain("nodejs_eventloop_lag_seconds");
    expect(output).toContain("process_cpu_seconds_total");
  });

  test("stamps every metric with the app default label", async () => {
    const output = await metricsRegistry.metrics();

    expect(output).toContain('app="boringstack-api"');
  });

  test("is a process-wide singleton across imports", async () => {
    const second = await import("../../../src/lib/metrics/registry");

    expect(second.metricsRegistry).toBe(metricsRegistry);
  });
});
