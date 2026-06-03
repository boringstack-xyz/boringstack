import { describe, expect, test } from "bun:test";

import { nodejsEventLoopUtilization } from "../../../src/lib/metrics/event-loop-metrics";
import { metricsRegistry } from "../../../src/lib/metrics/registry";

describe("nodejsEventLoopUtilization", () => {
  test("is registered on the global registry", () => {
    expect(
      metricsRegistry.getSingleMetric("nodejs_eventloop_utilization")
    ).toBe(nodejsEventLoopUtilization);
  });

  test("collects an interval utilisation between 0 and 1 on scrape", async () => {
    /*
     * get() triggers the collect() hook, which diffs ELU against the
     * previous sample — the resulting gauge must stay on the 0..1 scale.
     */
    const metric = await nodejsEventLoopUtilization.get();
    const sample = metric.values[0];

    expect(sample).toBeDefined();
    expect(sample?.value).toBeGreaterThanOrEqual(0);
    expect(sample?.value).toBeLessThanOrEqual(1);
  });

  test("re-scraping keeps the interval semantics (no cumulative drift)", async () => {
    const first = await nodejsEventLoopUtilization.get();
    const second = await nodejsEventLoopUtilization.get();

    for (const reading of [first, second]) {
      expect(reading.values[0]?.value).toBeGreaterThanOrEqual(0);
      expect(reading.values[0]?.value).toBeLessThanOrEqual(1);
    }
  });
});
