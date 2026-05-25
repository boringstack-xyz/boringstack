import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useWidgets } from "./Widgets.queries";

const apiMock = vi.hoisted(() => ({
  GET: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({ apiClient: apiMock }));

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

beforeEach(() => {
  apiMock.GET.mockReset();
});

describe("useWidgets", () => {
  it("loads widgets from the typed API client", async () => {
    apiMock.GET.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: "widget-1",
            accountId: "account-1",
            name: "Launch checklist",
            createdAt: "2026-05-24T00:00:00.000Z",
            updatedAt: "2026-05-24T00:00:00.000Z"
          }
        ]
      }
    });

    const { result } = renderHook(() => useWidgets(), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.data?.[0]?.name).toBe("Launch checklist");
    });

    expect(apiMock.GET).toHaveBeenCalledWith("/api/v1/widgets/");
  });

  it("falls back to an empty list when the API returns no body", async () => {
    apiMock.GET.mockResolvedValueOnce({ data: undefined });

    const { result } = renderHook(() => useWidgets(), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.data).toEqual([]);
    });
  });
});
