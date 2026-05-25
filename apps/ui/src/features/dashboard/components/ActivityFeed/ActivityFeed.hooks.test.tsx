import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useActivityFeed } from "./ActivityFeed.hooks";

const apiMock = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: apiMock
}));

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  apiMock.GET.mockReset();
});

describe("useActivityFeed (view model)", () => {
  it("flattens infinite-query pages into a single items array", async () => {
    apiMock.GET.mockResolvedValueOnce({
      data: {
        items: [
          { id: "a1", title: "First", timestamp: "2026-01-01T00:00:00Z" },
          { id: "a2", title: "Second", timestamp: "2026-01-02T00:00:00Z" }
        ],
        nextCursor: null
      },
      response: {}
    });

    const { result } = renderHook(() => useActivityFeed({}), {
      wrapper: makeWrapper()
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0]?.id).toBe("a1");
    expect(result.current.isEmpty).toBe(false);
    expect(result.current.hasNextPage).toBe(false);
  });

  it("reports isEmpty when the API returns zero items", async () => {
    apiMock.GET.mockResolvedValueOnce({
      data: { items: [], nextCursor: null },
      response: {}
    });

    const { result } = renderHook(() => useActivityFeed({}), {
      wrapper: makeWrapper()
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isEmpty).toBe(true);
  });

  it("passes through the className prop", () => {
    apiMock.GET.mockResolvedValueOnce({
      data: { items: [], nextCursor: null },
      response: {}
    });

    const { result } = renderHook(() => useActivityFeed({ className: "x" }), {
      wrapper: makeWrapper()
    });

    expect(result.current.className).toBe("x");
  });
});
