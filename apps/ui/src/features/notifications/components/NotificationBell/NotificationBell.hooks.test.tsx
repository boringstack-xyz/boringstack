import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useNotificationBell } from "./NotificationBell.hooks";

const apiMock = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  PUT: vi.fn(),
  DELETE: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({ apiClient: apiMock }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { count?: number }) =>
      opts?.count !== undefined ? `${key}:${String(opts.count)}` : key,
    i18n: { language: "en" }
  })
}));

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return { Wrapper };
}

beforeEach(() => {
  apiMock.GET.mockReset();
});

describe("useNotificationBell", () => {
  it("renders zero unread when the count endpoint has not resolved yet", () => {
    apiMock.GET.mockImplementation(() => new Promise(() => undefined));

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useNotificationBell(), {
      wrapper: Wrapper
    });

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.hasUnread).toBe(false);
  });

  it("reflects the unread count when the API resolves", async () => {
    const items = Array.from({ length: 7 }, (_, i) => ({
      id: `n-${String(i)}`,
      eventType: "test.event",
      title: "T",
      body: "B",
      ctaUrl: null,
      ctaLabel: null,
      status: "unread",
      readAt: null,
      createdAt: "2026-05-17T00:00:00.000Z"
    }));

    apiMock.GET.mockResolvedValueOnce({ data: { items, nextCursor: null } });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useNotificationBell(), {
      wrapper: Wrapper
    });

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(7);
    });

    expect(result.current.hasUnread).toBe(true);
    expect(result.current.ariaLabel).toContain("7");
  });

  it("uses the unread-zero aria label key when count is 0", async () => {
    apiMock.GET.mockResolvedValueOnce({
      data: { items: [], nextCursor: null }
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useNotificationBell(), {
      wrapper: Wrapper
    });

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(0);
    });

    expect(result.current.ariaLabel).toBe("notifications.bellAriaLabel");
  });
});
