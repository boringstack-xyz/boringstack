import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/ApiError";

import { makeUser } from "../../../tests/factories";
import { useMe } from "./useMe";

const apiMock = vi.hoisted(() => ({
  GET: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: apiMock
}));

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

const ME_PAYLOAD = {
  user: makeUser({ firstName: "Demo", lastName: "User" }),
  account: { id: "acc-1", name: "Demo Account" },
  role: "owner" as const,
  memberships: [
    { accountId: "acc-1", accountName: "Demo Account", role: "owner" as const }
  ],
  features: { can_export: true, can_invite_team: true, max_seats: 5 },
  capabilities: { billing: false, notificationsSse: true, webPush: true },
  authProviders: ["local"],
  hasPasswordLogin: true
};

beforeEach(() => {
  apiMock.GET.mockReset();
});

describe("useMe", () => {
  it("propagates 401 as an ApiError (consumer distinguishes auth failure from anonymous)", async () => {
    apiMock.GET.mockRejectedValueOnce(
      new ApiError(401, { message: "Unauthorized" })
    );
    const { result } = renderHook(() => useMe(), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect((result.current.error as ApiError).isUnauthorized).toBe(true);
  });

  it("returns the full session payload when the API responds 200 with the authenticated shape", async () => {
    apiMock.GET.mockResolvedValueOnce({ data: ME_PAYLOAD, response: {} });
    const { result } = renderHook(() => useMe(), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(ME_PAYLOAD);
  });

  it("returns null when the API responds 200 `{ user: null }` (anonymous probe)", async () => {
    apiMock.GET.mockResolvedValueOnce({
      data: { user: null },
      response: {}
    });
    const { result } = renderHook(() => useMe(), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBeNull();
  });

  it("returns null when the response data is absent", async () => {
    apiMock.GET.mockResolvedValueOnce({ data: undefined, response: {} });
    const { result } = renderHook(() => useMe(), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBeNull();
  });

  it("propagates 5xx server errors instead of silently logging the user out", async () => {
    apiMock.GET.mockRejectedValueOnce(
      new ApiError(500, { message: "Server error" })
    );
    const { result } = renderHook(() => useMe(), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toBeInstanceOf(ApiError);
  });

  it("propagates network errors so the offline fallback can render", async () => {
    apiMock.GET.mockRejectedValueOnce(new Error("network is down"));
    const { result } = renderHook(() => useMe(), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error).not.toBeInstanceOf(ApiError);
  });
});
