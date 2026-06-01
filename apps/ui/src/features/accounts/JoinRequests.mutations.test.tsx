import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useApproveJoinRequest,
  useDenyJoinRequest
} from "./JoinRequests.mutations";

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

const row: {
  id: string;
  accountId: string;
  userId: string;
  email: string;
  status: "pending" | "approved" | "denied";
  createdAt: string;
  decidedAt: string | null;
  decidedByUserId: string | null;
} = {
  id: "jr1",
  accountId: "acc-1",
  userId: "u1",
  email: "x@example.com",
  status: "approved",
  createdAt: "2026-06-01T00:00:00Z",
  decidedAt: "2026-06-01T00:00:00Z",
  decidedByUserId: "u-owner"
};

beforeEach(() => {
  apiMock.POST.mockReset();
});

describe("useApproveJoinRequest", () => {
  it("rejects when no accountId is supplied (never calls the API)", async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useApproveJoinRequest(undefined), {
      wrapper: Wrapper
    });

    await act(async () => {
      await result.current
        .mutateAsync({ requestId: "jr1" })
        .catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(apiMock.POST).not.toHaveBeenCalled();
  });

  it("POSTs the approve endpoint and returns the row", async () => {
    apiMock.POST.mockResolvedValueOnce({
      data: { success: true, data: row, timestamp: "t" }
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useApproveJoinRequest("acc-1"), {
      wrapper: Wrapper
    });

    let response: typeof row | undefined;

    await act(async () => {
      response = await result.current.mutateAsync({ requestId: "jr1" });
    });

    expect(apiMock.POST).toHaveBeenCalledWith(
      "/api/v1/accounts/{id}/join-requests/{requestId}/approve",
      { params: { path: { id: "acc-1", requestId: "jr1" } } }
    );
    expect(response).toEqual(row);
  });
});

describe("useDenyJoinRequest", () => {
  it("POSTs the deny endpoint and returns the row", async () => {
    apiMock.POST.mockResolvedValueOnce({
      data: {
        success: true,
        data: { ...row, status: "denied" },
        timestamp: "t"
      }
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useDenyJoinRequest("acc-1"), {
      wrapper: Wrapper
    });

    await act(async () => {
      await result.current.mutateAsync({ requestId: "jr1" });
    });

    expect(apiMock.POST).toHaveBeenCalledWith(
      "/api/v1/accounts/{id}/join-requests/{requestId}/deny",
      { params: { path: { id: "acc-1", requestId: "jr1" } } }
    );
  });
});
