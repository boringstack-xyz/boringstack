import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useNotificationCenterPopover } from "./NotificationCenterPopover.hooks";

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
});

describe("useNotificationCenterPopover", () => {
  it("reports isLoading until the list resolves", () => {
    apiMock.GET.mockImplementation(() => new Promise(() => undefined));

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useNotificationCenterPopover(), {
      wrapper: Wrapper
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.items).toEqual([]);
  });

  it("flattens pages into a capped items array once the list resolves", async () => {
    const items = Array.from({ length: 3 }, (_, i) => ({
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

    apiMock.GET.mockResolvedValueOnce({
      data: { items, nextCursor: null }
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useNotificationCenterPopover(), {
      wrapper: Wrapper
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(3);
    });
  });

  it("isEmpty is true when the list resolves with no items", async () => {
    apiMock.GET.mockResolvedValueOnce({
      data: { items: [], nextCursor: null }
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useNotificationCenterPopover(), {
      wrapper: Wrapper
    });

    await waitFor(() => {
      expect(result.current.isEmpty).toBe(true);
    });
  });
});
