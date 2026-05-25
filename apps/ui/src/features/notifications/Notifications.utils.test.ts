import { describe, expect, it } from "vitest";

import type { INotification, INotificationPage } from "./Notifications.types";
import {
  applyMarkAllReadToCache,
  applyStatusToCache,
  countUnread,
  prependNotificationToCache
} from "./Notifications.utils";

function makeNotification(
  overrides: Partial<INotification> = {}
): INotification {
  return {
    id: "n1",
    eventType: "test.event",
    title: "Title",
    body: "Body",
    ctaUrl: null,
    ctaLabel: null,
    status: "unread",
    readAt: null,
    createdAt: "2026-05-15T00:00:00.000Z",
    ...overrides
  };
}

function makeCache(items: INotification[]) {
  const page: INotificationPage = { items, nextCursor: null };

  return { pages: [page], pageParams: [undefined] };
}

describe("countUnread", () => {
  it("returns 0 when undefined", () => {
    expect(countUnread(undefined)).toBe(0);
  });

  it("counts only unread items across pages", () => {
    const pages: INotificationPage[] = [
      {
        items: [
          makeNotification({ id: "1", status: "unread" }),
          makeNotification({ id: "2", status: "read" })
        ],
        nextCursor: "x"
      },
      {
        items: [
          makeNotification({ id: "3", status: "unread" }),
          makeNotification({ id: "4", status: "archived" })
        ],
        nextCursor: null
      }
    ];

    expect(countUnread(pages)).toBe(2);
  });
});

describe("applyStatusToCache", () => {
  it("updates the matching item's status and stamps readAt when going to read", () => {
    const cache = makeCache([
      makeNotification({ id: "1", status: "unread" }),
      makeNotification({ id: "2", status: "unread" })
    ]);

    const next = applyStatusToCache(cache, "1", "read");

    expect(next?.pages[0]?.items[0]?.status).toBe("read");
    expect(next?.pages[0]?.items[0]?.readAt).not.toBeNull();
    expect(next?.pages[0]?.items[1]?.status).toBe("unread");
  });

  it("returns undefined when cache is undefined", () => {
    expect(applyStatusToCache(undefined, "x", "read")).toBeUndefined();
  });
});

describe("applyMarkAllReadToCache", () => {
  it("flips every unread item to read", () => {
    const cache = makeCache([
      makeNotification({ id: "1", status: "unread" }),
      makeNotification({ id: "2", status: "read" }),
      makeNotification({ id: "3", status: "archived" })
    ]);

    const next = applyMarkAllReadToCache(cache);

    expect(next?.pages[0]?.items.map((i) => i.status)).toEqual([
      "read",
      "read",
      "archived"
    ]);
  });
});

describe("prependNotificationToCache", () => {
  it("prepends a new notification to the first page", () => {
    const cache = makeCache([makeNotification({ id: "existing" })]);
    const incoming = makeNotification({ id: "new" });

    const next = prependNotificationToCache(cache, incoming);

    expect(next?.pages[0]?.items.map((i) => i.id)).toEqual(["new", "existing"]);
  });

  it("does not double-insert when id already exists", () => {
    const cache = makeCache([makeNotification({ id: "dup" })]);
    const next = prependNotificationToCache(
      cache,
      makeNotification({ id: "dup" })
    );

    expect(next?.pages[0]?.items.length).toBe(1);
  });

  it("returns input unchanged when cache has no pages", () => {
    const cache = { pages: [], pageParams: [] };

    expect(prependNotificationToCache(cache, makeNotification())).toBe(cache);
  });
});
