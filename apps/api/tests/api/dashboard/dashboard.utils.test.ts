import { describe, expect, test } from "bun:test";

import {
  formatActivityTitle,
  parseDashboardLimit,
} from "../../../src/api/dashboard/dashboard.utils";
import { DASHBOARD_ACTIVITY_MAX_LIMIT } from "../../../src/api/dashboard/dashboard.constants";

describe("formatActivityTitle", () => {
  test("uses the known label and appends the resource when present", () => {
    expect(formatActivityTitle("widget.created", "widget:abc-123")).toBe(
      "Created a widget — widget:abc-123"
    );
  });

  test("uses the known label only when resource is null", () => {
    expect(formatActivityTitle("auth.login_success", null)).toBe("Signed in");
  });

  test("uses the known label only when resource is empty string", () => {
    expect(formatActivityTitle("account.deleted", "")).toBe("Deleted account");
  });

  test("derives a label from an unknown action key", () => {
    expect(formatActivityTitle("comment.replied", null)).toBe(
      "Comment replied"
    );
  });

  test("falls back to 'Activity' for empty action keys", () => {
    expect(formatActivityTitle("", null)).toBe("Activity");
  });
});

describe("parseDashboardLimit", () => {
  test("returns default when raw is undefined", () => {
    const result = parseDashboardLimit(undefined);

    expect(result).toBe(20);
  });

  test("returns default when raw is empty string", () => {
    const result = parseDashboardLimit("");

    expect(result).toBe(20);
  });

  test("parses a valid numeric string", () => {
    expect(parseDashboardLimit("5")).toBe(5);
  });

  test("returns default for NaN input", () => {
    expect(parseDashboardLimit("abc")).toBe(20);
  });

  test("returns default for zero", () => {
    expect(parseDashboardLimit("0")).toBe(20);
  });

  test("returns default for negative numbers", () => {
    expect(parseDashboardLimit("-5")).toBe(20);
  });

  test("caps at the hard max", () => {
    const huge = String(DASHBOARD_ACTIVITY_MAX_LIMIT + 1);

    expect(parseDashboardLimit(huge)).toBe(DASHBOARD_ACTIVITY_MAX_LIMIT);
  });

  test("returns the exact max when equal", () => {
    const exact = String(DASHBOARD_ACTIVITY_MAX_LIMIT);

    expect(parseDashboardLimit(exact)).toBe(DASHBOARD_ACTIVITY_MAX_LIMIT);
  });
});
