import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useLeaveAccount, useSwitchAccount } from "./Memberships.mutations";

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

describe("useSwitchAccount", () => {
  it("POSTs /api/v1/accounts/switch and resolves with the new accountId", async () => {
    apiMock.POST.mockResolvedValueOnce({
      data: { success: true, data: { accountId: "acc-2" }, timestamp: "t" }
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useSwitchAccount(), {
      wrapper: Wrapper
    });

    let response: { accountId: string } | undefined;

    await act(async () => {
      response = await result.current.mutateAsync({ accountId: "acc-2" });
    });

    expect(apiMock.POST).toHaveBeenCalledWith("/api/v1/accounts/switch", {
      body: { accountId: "acc-2" }
    });
    expect(response).toEqual({ accountId: "acc-2" });
  });

  it("throws when the server returns no data envelope", async () => {
    apiMock.POST.mockResolvedValueOnce({ data: null });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useSwitchAccount(), {
      wrapper: Wrapper
    });

    await act(async () => {
      await result.current
        .mutateAsync({ accountId: "acc-2" })
        .catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe("useLeaveAccount", () => {
  it("rejects synchronously when no accountId is supplied", async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useLeaveAccount(undefined), {
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

  it("DELETEs /api/v1/accounts/{id}/memberships/me for the configured account", async () => {
    apiMock.DELETE.mockResolvedValueOnce({ data: null });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useLeaveAccount("acc-1"), {
      wrapper: Wrapper
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(apiMock.DELETE).toHaveBeenCalledWith(
      "/api/v1/accounts/{id}/memberships/me",
      {
        params: { path: { id: "acc-1" } }
      }
    );
  });
});
