import { describe, expect, it } from "vitest";

import type { INotificationPage } from "../../Notifications.types";
import { flattenPages } from "./NotificationsPage.utils";

const makePage = (idx: number, count: number): INotificationPage => ({
  items: Array.from({ length: count }, (_, i) => ({
    id: `p${String(idx)}-${String(i)}`,
    eventType: "test.event",
    title: "T",
    body: "B",
    ctaUrl: null,
    ctaLabel: null,
    status: "unread",
    readAt: null,
    createdAt: "2026-05-17T00:00:00.000Z"
  })),
  nextCursor: null
});

describe("flattenPages", () => {
  it("returns an empty array for undefined input", () => {
    expect(flattenPages(undefined)).toEqual([]);
  });

  it("returns an empty array for an empty pages list", () => {
    expect(flattenPages([])).toEqual([]);
  });

  it("concatenates items across pages preserving page order", () => {
    const flat = flattenPages([makePage(0, 2), makePage(1, 3)]);

    expect(flat).toHaveLength(5);
    expect(flat[0]?.id).toBe("p0-0");
    expect(flat[2]?.id).toBe("p1-0");
    expect(flat[4]?.id).toBe("p1-2");
  });
});
