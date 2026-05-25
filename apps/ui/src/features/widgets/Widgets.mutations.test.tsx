import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/ApiError";

import {
  useCreateWidget,
  useDeleteWidget,
  useUpdateWidget
} from "./Widgets.mutations";

const apiMock = vi.hoisted(() => ({
  POST: vi.fn(),
  PATCH: vi.fn(),
  DELETE: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({ apiClient: apiMock }));

const widget = {
  id: "widget-1",
  accountId: "account-1",
  name: "Launch checklist",
  createdAt: "2026-05-24T00:00:00.000Z",
  updatedAt: "2026-05-24T00:00:00.000Z"
};

function wrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

beforeEach(() => {
  apiMock.POST.mockReset();
  apiMock.PATCH.mockReset();
  apiMock.DELETE.mockReset();
});

describe("widget mutations", () => {
  it("creates a widget through the typed API client", async () => {
    apiMock.POST.mockResolvedValueOnce({ data: widget });

    const { result } = renderHook(() => useCreateWidget(), {
      wrapper: wrapper()
    });

    await act(async () => {
      await result.current.mutateAsync({ name: "Launch checklist" });
    });

    expect(apiMock.POST).toHaveBeenCalledWith("/api/v1/widgets/", {
      body: { name: "Launch checklist" }
    });
  });

  it("throws a domain ApiError when create returns no body", async () => {
    apiMock.POST.mockResolvedValueOnce({ data: undefined });

    const { result } = renderHook(() => useCreateWidget(), {
      wrapper: wrapper()
    });

    await expect(
      result.current.mutateAsync({ name: "Launch checklist" })
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("updates a widget by id", async () => {
    apiMock.PATCH.mockResolvedValueOnce({ data: widget });

    const { result } = renderHook(() => useUpdateWidget(), {
      wrapper: wrapper()
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: "widget-1",
        input: { name: "Renamed" }
      });
    });

    expect(apiMock.PATCH).toHaveBeenCalledWith("/api/v1/widgets/{id}", {
      params: { path: { id: "widget-1" } },
      body: { name: "Renamed" }
    });
  });

  it("deletes a widget by id", async () => {
    apiMock.DELETE.mockResolvedValueOnce({ data: { success: true } });

    const { result } = renderHook(() => useDeleteWidget(), {
      wrapper: wrapper()
    });

    await act(async () => {
      await result.current.mutateAsync({ id: "widget-1" });
    });

    expect(apiMock.DELETE).toHaveBeenCalledWith("/api/v1/widgets/{id}", {
      params: { path: { id: "widget-1" } }
    });
  });
});
