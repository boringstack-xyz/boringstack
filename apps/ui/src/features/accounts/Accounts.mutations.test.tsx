import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDeleteAccount, useTransferOwnership } from "./Accounts.mutations";

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

  return { Wrapper, client };
}

beforeEach(() => {
  apiMock.POST.mockReset();
  apiMock.DELETE.mockReset();
});

describe("useTransferOwnership", () => {
  it("rejects synchronously when no accountId is supplied", async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useTransferOwnership(undefined), {
      wrapper: Wrapper
    });

    await act(async () => {
      await result.current
        .mutateAsync({ toUserId: "u-2" })
        .catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(apiMock.POST).not.toHaveBeenCalled();
  });

  it("POSTs to /api/v1/accounts/{id}/transfer-ownership when an accountId is supplied", async () => {
    apiMock.POST.mockResolvedValueOnce({
      data: { success: true, data: { transferred: true }, timestamp: "t" }
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useTransferOwnership("acc-1"), {
      wrapper: Wrapper
    });

    await act(async () => {
      await result.current.mutateAsync({ toUserId: "u-2" });
    });

    expect(apiMock.POST).toHaveBeenCalledWith(
      "/api/v1/accounts/{id}/transfer-ownership",
      {
        params: { path: { id: "acc-1" } },
        body: { toUserId: "u-2" }
      }
    );
  });
});

describe("useDeleteAccount", () => {
  it("rejects when no accountId is supplied", async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeleteAccount(undefined), {
      wrapper: Wrapper
    });

    await act(async () => {
      await result.current.mutateAsync().catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(apiMock.DELETE).not.toHaveBeenCalled();
  });

  it("DELETEs /api/v1/accounts/{id} for the configured account", async () => {
    apiMock.DELETE.mockResolvedValueOnce({ data: null });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeleteAccount("acc-1"), {
      wrapper: Wrapper
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(apiMock.DELETE).toHaveBeenCalledWith("/api/v1/accounts/{id}", {
      params: { path: { id: "acc-1" } }
    });
  });
});
