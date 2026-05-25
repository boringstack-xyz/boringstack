import { describe, expect, it } from "vitest";

import { dashboardSummarySchema } from "./Dashboard.schemas";

describe("dashboardSummarySchema", () => {
  it("accepts a well-formed summary", () => {
    const result = dashboardSummarySchema.safeParse({
      totalEvents: 42,
      recentActivity: [
        { id: "a", title: "Logged in", timestamp: "2026-05-17T12:00:00Z" }
      ]
    });

    expect(result.success).toBe(true);
  });

  it("accepts an empty recentActivity array", () => {
    const result = dashboardSummarySchema.safeParse({
      totalEvents: 0,
      recentActivity: []
    });

    expect(result.success).toBe(true);
  });

  it("rejects a negative totalEvents", () => {
    const result = dashboardSummarySchema.safeParse({
      totalEvents: -1,
      recentActivity: []
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-integer totalEvents", () => {
    const result = dashboardSummarySchema.safeParse({
      totalEvents: 1.5,
      recentActivity: []
    });

    expect(result.success).toBe(false);
  });

  it("rejects activity rows missing required fields", () => {
    const result = dashboardSummarySchema.safeParse({
      totalEvents: 1,
      recentActivity: [{ id: "x", title: "no timestamp" }]
    });

    expect(result.success).toBe(false);
  });
});
