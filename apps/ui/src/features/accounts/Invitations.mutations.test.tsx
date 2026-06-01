import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useInviteMember,
  useResendInvitation,
  useRevokeInvitation
} from "./Invitations.mutations";

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

beforeEach(() => {
  apiMock.POST.mockReset();
  apiMock.DELETE.mockReset();
});

describe("useInviteMember", () => {
  it("rejects when no accountId is supplied", async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useInviteMember(undefined), {
      wrapper: Wrapper
    });

    await act(async () => {
      await result.current
        .mutateAsync({ email: "x@example.com", roleToAssign: "member" })
        .catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(apiMock.POST).not.toHaveBeenCalled();
  });

  it("POSTs /api/v1/accounts/{id}/invitations with the form payload", async () => {
    apiMock.POST.mockResolvedValueOnce({
      data: {
        id: "i-1",
        accountId: "acc-1",
        email: "x@example.com",
        roleToAssign: "member",
        expiresAt: "2026-06-01T00:00:00Z",
        rawToken: "tok"
      }
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useInviteMember("acc-1"), {
      wrapper: Wrapper
    });

    await act(async () => {
      await result.current.mutateAsync({
        email: "x@example.com",
        roleToAssign: "member"
      });
    });

    expect(apiMock.POST).toHaveBeenCalledWith(
      "/api/v1/accounts/{id}/invitations",
      {
        params: { path: { id: "acc-1" } },
        body: { email: "x@example.com", roleToAssign: "member" }
      }
    );
  });
});

describe("useResendInvitation", () => {
  it("POSTs the resend endpoint and resolves with the new rawToken", async () => {
    apiMock.POST.mockResolvedValueOnce({
      data: {
        id: "i-1",
        accountId: "acc-1",
        email: "x@example.com",
        roleToAssign: "member",
        expiresAt: "2026-06-01T00:00:00Z",
        rawToken: "fresh-tok"
      }
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useResendInvitation("acc-1"), {
      wrapper: Wrapper
    });

    let response: { rawToken?: string } | undefined;

    await act(async () => {
      response = await result.current.mutateAsync({
        invitationId: "i-1"
      });
    });

    expect(apiMock.POST).toHaveBeenCalledWith(
      "/api/v1/accounts/{id}/invitations/{invitationId}/resend",
      {
        params: { path: { id: "acc-1", invitationId: "i-1" } }
      }
    );
    expect(response?.rawToken).toBe("fresh-tok");
  });
});

describe("useRevokeInvitation", () => {
  it("DELETEs the invitation under the supplied accountId", async () => {
    apiMock.DELETE.mockResolvedValueOnce({ data: null });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useRevokeInvitation("acc-1"), {
      wrapper: Wrapper
    });

    await act(async () => {
      await result.current.mutateAsync({ invitationId: "i-1" });
    });

    expect(apiMock.DELETE).toHaveBeenCalledWith(
      "/api/v1/accounts/{id}/invitations/{invitationId}",
      { params: { path: { id: "acc-1", invitationId: "i-1" } } }
    );
  });
});
