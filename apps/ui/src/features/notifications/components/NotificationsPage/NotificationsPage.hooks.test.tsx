import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useNotificationsPage } from "./NotificationsPage.hooks";

const apiMock = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  PUT: vi.fn(),
  DELETE: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({ apiClient: apiMock }));

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return { Wrapper };
}

beforeEach(() => {
  apiMock.GET.mockReset();
  apiMock.POST.mockReset();
  apiMock.PATCH.mockReset();
});

describe("useNotificationsPage", () => {
  it("starts with no status filter and isLoading=true", () => {
    apiMock.GET.mockImplementation(() => new Promise(() => undefined));

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useNotificationsPage(), {
      wrapper: Wrapper
    });

    expect(result.current.status).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
  });

  it("flattens pages once the list query resolves", async () => {
    const items = [
      {
        id: "n-1",
        eventType: "test.event",
        title: "T",
        body: "B",
        ctaUrl: null,
        ctaLabel: null,
        status: "unread",
        readAt: null,
        createdAt: "2026-05-17T00:00:00.000Z"
      }
    ];

    apiMock.GET.mockResolvedValueOnce({
      data: { items, nextCursor: null }
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useNotificationsPage(), {
      wrapper: Wrapper
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    expect(result.current.isEmpty).toBe(false);
  });

  it("onTabChange updates the status filter from a recognized tab value", async () => {
    apiMock.GET.mockResolvedValueOnce({
      data: { items: [], nextCursor: null }
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useNotificationsPage(), {
      wrapper: Wrapper
    });

    act(() => {
      result.current.onTabChange("unread");
    });

    await waitFor(() => {
      expect(result.current.status).toBe("unread");
    });
  });

  it("isEmpty is true once the list resolves with no items", async () => {
    apiMock.GET.mockResolvedValueOnce({
      data: { items: [], nextCursor: null }
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useNotificationsPage(), {
      wrapper: Wrapper
    });

    await waitFor(() => {
      expect(result.current.isEmpty).toBe(true);
    });
  });
});
