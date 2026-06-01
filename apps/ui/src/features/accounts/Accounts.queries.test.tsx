import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useInvitations } from "./Accounts.queries";

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

describe("useInvitations", () => {
  it("is disabled when accountId is undefined (never calls the API)", () => {
    const { Wrapper } = makeWrapper();

    renderHook(() => useInvitations(undefined), { wrapper: Wrapper });

    expect(apiMock.GET).not.toHaveBeenCalled();
  });

  it("fetches /api/v1/accounts/:id/invitations and resolves to the row array", async () => {
    const rows = [
      {
        id: "i1",
        accountId: "acc-1",
        email: "x@example.com",
        roleToAssign: "member",
        expiresAt: "2026-06-01T00:00:00Z"
      }
    ];

    apiMock.GET.mockResolvedValueOnce({ data: rows });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useInvitations("acc-1"), {
      wrapper: Wrapper
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiMock.GET).toHaveBeenCalledWith(
      "/api/v1/accounts/{id}/invitations",
      { params: { path: { id: "acc-1" } } }
    );
    expect(result.current.data).toEqual(rows);
  });

  it("resolves to an empty array when the API returns nullish data", async () => {
    apiMock.GET.mockResolvedValueOnce({ data: undefined });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useInvitations("acc-1"), {
      wrapper: Wrapper
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });
});
