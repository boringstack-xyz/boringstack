import { beforeEach, describe, expect, it } from "vitest";

import { userSchema } from "@/features/auth/Auth.schemas";
import { dashboardSummarySchema } from "@/features/dashboard/Dashboard.schemas";

import { makeDashboardSummary, makeUser, resetUserFactory } from "./index";

describe("makeUser", () => {
  beforeEach(() => {
    resetUserFactory();
  });

  it("produces a payload that passes the userSchema", () => {
    const user = makeUser();

    expect(userSchema.safeParse(user).success).toBe(true);
  });

  it("respects overrides", () => {
    const user = makeUser({ email: "x@y.com", firstName: "Ada" });

    expect(user.email).toBe("x@y.com");
    expect(user.firstName).toBe("Ada");
  });

  it("each call yields a unique id (so distinct users coexist in one test)", () => {
    const a = makeUser();
    const b = makeUser();

    expect(a.id).not.toBe(b.id);
  });

  it("resetUserFactory makes the next call's id predictable again", () => {
    makeUser();
    makeUser();
    resetUserFactory();
    const reset = makeUser();

    expect(reset.id).toMatch(/^f47ac10b-58cc-4372-a567-[0-9a-f]{12}$/);
  });
});

describe("makeDashboardSummary", () => {
  it("produces a payload that passes the dashboardSummarySchema", () => {
    expect(
      dashboardSummarySchema.safeParse(makeDashboardSummary()).success
    ).toBe(true);
  });

  it("respects overrides", () => {
    const summary = makeDashboardSummary({ totalEvents: 99 });

    expect(summary.totalEvents).toBe(99);
  });

  it("recentActivity is always non-empty in the default", () => {
    expect(makeDashboardSummary().recentActivity.length).toBeGreaterThan(0);
  });
});
