import { describe, expect, test } from "bun:test";

import { createApp } from "../../../src/config/app";

const isReadinessCheckEntry = (
  value: unknown
): value is { name: string; status: string; latencyMs: number } => {
  if (value === null || typeof value !== "object") {
    return false;
  }

  if (!("name" in value) || typeof value.name !== "string") {
    return false;
  }

  if (!("status" in value) || typeof value.status !== "string") {
    return false;
  }

  if (!("latencyMs" in value) || typeof value.latencyMs !== "number") {
    return false;
  }

  return true;
};

const isReadinessReport = (
  value: unknown
): value is { status: string; checks: Record<string, unknown> } => {
  if (value === null || typeof value !== "object") {
    return false;
  }

  if (!("status" in value) || typeof value.status !== "string") {
    return false;
  }

  if (!("checks" in value) || typeof value.checks !== "object") {
    return false;
  }

  return true;
};

const isLivenessReport = (
  value: unknown
): value is { status: string; timestamp: string } => {
  if (value === null || typeof value !== "object") {
    return false;
  }

  return (
    "status" in value &&
    typeof value.status === "string" &&
    "timestamp" in value &&
    typeof value.timestamp === "string"
  );
};

const isRootReport = (
  value: unknown
): value is { name: string; status: string } => {
  if (value === null || typeof value !== "object") {
    return false;
  }

  return (
    "name" in value &&
    typeof value.name === "string" &&
    "status" in value &&
    typeof value.status === "string"
  );
};

describe("Health probes", () => {
  test("GET / returns 200 with the service name", async () => {
    const app = createApp();
    const res = await app.handle(new Request("http://localhost/"));

    expect(res.status).toBe(200);

    const body: unknown = await res.json();

    if (!isRootReport(body)) {
      throw new Error("root response missing name/status");
    }

    expect(body.name).toBe("api-template");
    expect(body.status).toBe("ok");
  });

  test("GET /health returns 200 with an ISO timestamp", async () => {
    const app = createApp();
    const res = await app.handle(new Request("http://localhost/health"));

    expect(res.status).toBe(200);

    const body: unknown = await res.json();

    if (!isLivenessReport(body)) {
      throw new Error("liveness response missing status/timestamp");
    }

    expect(body.status).toBe("ok");
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });

  test("GET /ready returns 200 or 503 with a structured readiness report", async () => {
    const app = createApp();
    const res = await app.handle(new Request("http://localhost/ready"));

    expect([200, 503]).toContain(res.status);

    const body: unknown = await res.json();

    if (!isReadinessReport(body)) {
      throw new Error("readiness response missing status/checks");
    }

    expect(typeof body.status).toBe("string");
    expect(body.checks).toBeDefined();
  });

  test("GET /ready returns a checks array with canonical shape", async () => {
    const app = createApp();
    const res = await app.handle(new Request("http://localhost/ready"));

    expect([200, 503]).toContain(res.status);

    const body: unknown = await res.json();

    if (
      body === null ||
      typeof body !== "object" ||
      !("checks" in body) ||
      !Array.isArray(body.checks)
    ) {
      throw new Error("/ready response missing checks array");
    }

    for (const rawCheck of body.checks) {
      if (!isReadinessCheckEntry(rawCheck)) {
        throw new Error("check missing name/status/latencyMs");
      }

      expect(["ok", "down", "degraded"]).toContain(rawCheck.status);
    }
  });

  test("GET /ready returns 200 when all checks are ok or degraded", async () => {
    const app = createApp();
    const res = await app.handle(new Request("http://localhost/ready"));

    expect([200, 503]).toContain(res.status);

    if (res.status !== 200) {
      return;
    }

    const body: unknown = await res.json();

    if (
      body === null ||
      typeof body !== "object" ||
      !("checks" in body) ||
      !Array.isArray(body.checks)
    ) {
      throw new Error("/ready response missing checks array");
    }

    for (const rawCheck of body.checks) {
      if (!isReadinessCheckEntry(rawCheck)) {
        throw new Error("check missing name/status/latencyMs");
      }

      expect(["ok", "degraded"]).toContain(rawCheck.status);
    }
  });

  test("GET /ready returns 503 when any check is down", async () => {
    const app = createApp();
    const res = await app.handle(new Request("http://localhost/ready"));

    if (res.status !== 503) {
      return;
    }

    const body: unknown = await res.json();

    if (
      body === null ||
      typeof body !== "object" ||
      !("checks" in body) ||
      !Array.isArray(body.checks)
    ) {
      throw new Error("/ready response missing checks array");
    }

    const hasDown = body.checks.some(
      (rawCheck: unknown) =>
        isReadinessCheckEntry(rawCheck) && rawCheck.status === "down"
    );

    expect(hasDown).toBe(true);
  });
});
