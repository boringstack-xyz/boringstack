import { describe, expect, test } from "bun:test";

import {
  isFeedItemVisible,
  isValidSnoozeHours,
} from "../../../src/api/admin/admin-feed.utils";

const NOW = Date.parse("2026-11-25T12:00:00.000Z");
const item = { key: "queue-failed:email-delivery", title: "t", count: 5 };

describe("isFeedItemVisible", () => {
  test("shows an item with no state", () => {
    expect(isFeedItemVisible(item, undefined, NOW)).toBe(true);
  });

  test("hides a resolved item until its count rises above the observed count", () => {
    const state = { state: "resolved", observedCount: 5, snoozedUntil: null };

    expect(isFeedItemVisible(item, state, NOW)).toBe(false);
    expect(isFeedItemVisible({ ...item, count: 6 }, state, NOW)).toBe(true);
  });

  test("hides a snoozed item until snoozedUntil has passed", () => {
    const state = {
      state: "snoozed",
      observedCount: 0,
      snoozedUntil: "2026-11-25T13:00:00.000Z",
    };

    expect(isFeedItemVisible(item, state, NOW)).toBe(false);
    expect(
      isFeedItemVisible(item, state, Date.parse("2026-11-25T13:00:00.000Z"))
    ).toBe(true);
  });
});

describe("isValidSnoozeHours", () => {
  test("accepts whole hours from 1 to 168", () => {
    expect(isValidSnoozeHours(1)).toBe(true);
    expect(isValidSnoozeHours(168)).toBe(true);
  });

  test("rejects zero, over a week, and fractions", () => {
    expect(isValidSnoozeHours(0)).toBe(false);
    expect(isValidSnoozeHours(169)).toBe(false);
    expect(isValidSnoozeHours(1.5)).toBe(false);
  });
});
