import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/ApiError";

import { useActivityFeed, useDashboardSummary } from "./Dashboard.queries";

const apiMock = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: apiMock
}));

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return { Wrapper, client };
}

function wrapper() {
  return makeWrapper().Wrapper;
}

beforeEach(() => {
  apiMock.GET.mockReset();
  apiMock.POST.mockReset();
});

describe("useDashboardSummary", () => {
  it("returns the summary on a 200 response", async () => {
    apiMock.GET.mockResolvedValueOnce({
      data: {
        totalEvents: 12,
        recentActivity: [{ id: "1", title: "first", timestamp: "2026-01-01" }]
      },
      response: {}
    });
    const { result } = renderHook(() => useDashboardSummary(), {
      wrapper: wrapper()
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.totalEvents).toBe(12);
  });

  it("surfaces 401 as an error (no implicit redirect — that's the route's job)", async () => {
    apiMock.GET.mockRejectedValueOnce(
      new ApiError(401, { message: "Unauthorized" })
    );
    const { result } = renderHook(() => useDashboardSummary(), {
      wrapper: wrapper()
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("surfaces 500 as an error", async () => {
    apiMock.GET.mockRejectedValueOnce(new ApiError(500, { message: "boom" }));
    const { result } = renderHook(() => useDashboardSummary(), {
      wrapper: wrapper()
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("throws when the response data is missing", async () => {
    apiMock.GET.mockResolvedValueOnce({ data: undefined, response: {} });
    const { result } = renderHook(() => useDashboardSummary(), {
      wrapper: wrapper()
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe("useActivityFeed (infinite query)", () => {
  it("loads the first page on mount", async () => {
    apiMock.GET.mockResolvedValueOnce({
      data: {
        items: [
          { id: "a1", title: "First", timestamp: "2026-01-01T00:00:00Z" }
        ],
        nextCursor: "page-1"
      },
      response: {}
    });
    const { result } = renderHook(() => useActivityFeed(), {
      wrapper: wrapper()
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.pages[0]?.items[0]?.id).toBe("a1");
    expect(result.current.hasNextPage).toBe(true);
  });

  it("fetchNextPage advances the cursor and appends a new page", async () => {
    apiMock.GET.mockResolvedValueOnce({
      data: {
        items: [{ id: "a1", title: "1", timestamp: "x" }],
        nextCursor: "page-1"
      },
      response: {}
    }).mockResolvedValueOnce({
      data: {
        items: [{ id: "a2", title: "2", timestamp: "x" }],
        nextCursor: null
      },
      response: {}
    });

    const { result } = renderHook(() => useActivityFeed(), {
      wrapper: wrapper()
    });

    await waitFor(() => {
      expect(result.current.hasNextPage).toBe(true);
    });
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => {
      expect(result.current.data?.pages.length ?? 0).toBe(2);
    });
    expect(result.current.hasNextPage).toBe(false);
  });
});
