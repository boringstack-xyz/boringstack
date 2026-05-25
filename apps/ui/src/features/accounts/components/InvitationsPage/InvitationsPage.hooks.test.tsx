import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useInvitationsPage } from "./InvitationsPage.hooks";

const apiMock = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  PUT: vi.fn(),
  DELETE: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({ apiClient: apiMock }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" }
  })
}));

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

function mockMe(canInvite: boolean): void {
  apiMock.GET.mockImplementation((path: string) => {
    if (path === "/api/v1/users/me") {
      return Promise.resolve({
        data: {
          user: {
            id: "u1",
            email: "x@example.com",
            firstName: "",
            lastName: ""
          },
          account: { id: "acc-1", name: "P", role: "owner" },
          memberships: [],
          features: { can_invite_team: canInvite },
          capabilities: {
            billing: false,
            notificationsSse: false,
            webPush: false
          }
        }
      });
    }

    return Promise.resolve({ data: [] });
  });
}

beforeEach(() => {
  apiMock.GET.mockReset();
  apiMock.POST.mockReset();
  apiMock.DELETE.mockReset();
});

describe("useInvitationsPage", () => {
  it("returns canInvite=false when the feature is not granted", async () => {
    mockMe(false);

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useInvitationsPage(), {
      wrapper: Wrapper
    });

    await waitFor(() => {
      expect(result.current.canInvite).toBe(false);
    });
  });

  it("returns canInvite=true + the accountId once /me resolves with the feature", async () => {
    mockMe(true);

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useInvitationsPage(), {
      wrapper: Wrapper
    });

    await waitFor(() => {
      expect(result.current.canInvite).toBe(true);
    });

    expect(result.current.accountId).toBe("acc-1");
  });

  it("onResend POSTs the resend endpoint with the invitationId", async () => {
    mockMe(true);
    apiMock.POST.mockResolvedValueOnce({ data: { id: "i-1" } });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useInvitationsPage(), {
      wrapper: Wrapper
    });

    await waitFor(() => {
      expect(result.current.accountId).toBe("acc-1");
    });

    await act(async () => {
      result.current.onResend("i-1");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(apiMock.POST).toHaveBeenCalledWith(
        "/api/v1/accounts/{id}/invitations/{invitationId}/resend",
        { params: { path: { id: "acc-1", invitationId: "i-1" } } }
      );
    });
  });

  it("onRevoke DELETEs the invitation under the active account", async () => {
    mockMe(true);
    apiMock.DELETE.mockResolvedValueOnce({ data: null });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useInvitationsPage(), {
      wrapper: Wrapper
    });

    await waitFor(() => {
      expect(result.current.accountId).toBe("acc-1");
    });

    await act(async () => {
      result.current.onRevoke("i-1");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(apiMock.DELETE).toHaveBeenCalledWith(
        "/api/v1/accounts/{id}/invitations/{invitationId}",
        { params: { path: { id: "acc-1", invitationId: "i-1" } } }
      );
    });
  });
});
