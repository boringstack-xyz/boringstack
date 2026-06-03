import { describe, expect, test } from "bun:test";

import {
  httpRequestDurationSeconds,
  httpRequestsTotal,
} from "../../../src/lib/metrics/http-metrics";
import { metricsRegistry } from "../../../src/lib/metrics/registry";

const METHOD_GET = "GET";
const METHOD_POST = "POST";

describe("http metrics", () => {
  test("counter and histogram are registered on the global registry", () => {
    expect(metricsRegistry.getSingleMetric("http_requests_total")).toBe(
      httpRequestsTotal
    );
    expect(
      metricsRegistry.getSingleMetric("http_request_duration_seconds")
    ).toBe(httpRequestDurationSeconds);
  });

  test("counter increments by method, route, and status labels", async () => {
    httpRequestsTotal.inc({ method: "GET", route: "/test", status: "200" });
    httpRequestsTotal.inc({ method: "GET", route: "/test", status: "200" });

    const metric = await httpRequestsTotal.get();
    const sample = metric.values.find(
      (value) =>
        value.labels.method === METHOD_GET &&
        value.labels.route === "/test" &&
        value.labels.status === "200"
    );

    expect(sample?.value).toBeGreaterThanOrEqual(2);
  });

  test("histogram observes durations into the configured buckets", async () => {
    httpRequestDurationSeconds.observe(
      { method: "POST", route: "/test", status: "201" },
      0.07
    );

    const metric = await httpRequestDurationSeconds.get();
    const count = metric.values.find(
      (value) =>
        value.metricName === "http_request_duration_seconds_count" &&
        value.labels.method === METHOD_POST &&
        value.labels.route === "/test"
    );

    expect(count?.value).toBeGreaterThanOrEqual(1);
  });
});
