import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useNotificationListItem } from "./NotificationListItem.hooks";
import type { INotificationListItemProps } from "./NotificationListItem.types";

function makeProps(
  overrides: Partial<INotificationListItemProps> = {}
): INotificationListItemProps {
  return {
    notification: {
      id: "n-1",
      eventType: "test.event",
      title: "T",
      body: "B",
      ctaUrl: null,
      ctaLabel: null,
      status: "unread",
      readAt: null,
      createdAt: "2026-05-17T00:00:00.000Z"
    },
    ...overrides
  };
}

describe("useNotificationListItem", () => {
  it("returns no-op callbacks when no handlers are passed", () => {
    const { result } = renderHook(() => useNotificationListItem(makeProps()));

    expect(() => {
      result.current.handleMarkRead();
    }).not.toThrow();
    expect(() => {
      result.current.handleArchive();
    }).not.toThrow();
  });

  it("forwards the notification id to onMarkRead", () => {
    const onMarkRead = vi.fn();
    const { result } = renderHook(() =>
      useNotificationListItem(makeProps({ onMarkRead }))
    );

    result.current.handleMarkRead();

    expect(onMarkRead).toHaveBeenCalledWith("n-1");
  });

  it("forwards the notification id to onArchive", () => {
    const onArchive = vi.fn();
    const { result } = renderHook(() =>
      useNotificationListItem(makeProps({ onArchive }))
    );

    result.current.handleArchive();

    expect(onArchive).toHaveBeenCalledWith("n-1");
  });
});
