import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuditLog } from "./AuditLog.queries";

const apiMock = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  PUT: vi.fn(),
  DELETE: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({ apiClient: apiMock }));

function wrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

beforeEach(() => {
  apiMock.GET.mockReset();
});

describe("useAuditLog", () => {
  it("stays disabled while accountId is undefined", () => {
    const Wrapper = wrapper();
    const { result } = renderHook(() => useAuditLog(undefined), {
      wrapper: Wrapper
    });

    expect(result.current.isPending).toBe(true);
    expect(apiMock.GET).not.toHaveBeenCalled();
  });

  it("GETs /api/v1/accounts/{id}/audit-log with the configured limit", async () => {
    apiMock.GET.mockResolvedValueOnce({
      data: { entries: [] }
    });

    const Wrapper = wrapper();
    const { result } = renderHook(() => useAuditLog("acc-1", 10), {
      wrapper: Wrapper
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiMock.GET).toHaveBeenCalledWith(
      "/api/v1/accounts/{id}/audit-log",
      {
        params: { path: { id: "acc-1" }, query: { limit: 10 } }
      }
    );
  });
});
