import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useJoinRequests } from "./JoinRequests.queries";

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

describe("useJoinRequests", () => {
  it("is disabled when accountId is undefined (never calls the API)", () => {
    const { Wrapper } = makeWrapper();

    renderHook(() => useJoinRequests(undefined), { wrapper: Wrapper });

    expect(apiMock.GET).not.toHaveBeenCalled();
  });

  it("fetches the pending list and resolves to the row array", async () => {
    const rows = [
      {
        id: "jr1",
        accountId: "acc-1",
        userId: "u1",
        email: "x@example.com",
        status: "pending" as const,
        createdAt: "2026-06-01T00:00:00Z",
        decidedAt: null,
        decidedByUserId: null
      }
    ];

    apiMock.GET.mockResolvedValueOnce({ data: rows });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useJoinRequests("acc-1"), {
      wrapper: Wrapper
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiMock.GET).toHaveBeenCalledWith(
      "/api/v1/accounts/{id}/join-requests",
      { params: { path: { id: "acc-1" } } }
    );
    expect(result.current.data).toEqual(rows);
  });

  it("resolves to an empty array when the API returns nullish data", async () => {
    apiMock.GET.mockResolvedValueOnce({ data: undefined });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useJoinRequests("acc-1"), {
      wrapper: Wrapper
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });
});
