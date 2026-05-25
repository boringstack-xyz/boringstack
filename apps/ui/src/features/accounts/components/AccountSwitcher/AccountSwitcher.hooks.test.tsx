import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAccountSwitcher } from "./AccountSwitcher.hooks";

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
  apiMock.GET.mockReset();
  apiMock.POST.mockReset();
});

describe("useAccountSwitcher", () => {
  it("returns empty memberships before /me resolves", () => {
    apiMock.GET.mockImplementation(() => new Promise(() => undefined));

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useAccountSwitcher(), {
      wrapper: Wrapper
    });

    expect(result.current.memberships).toEqual([]);
    expect(result.current.activeAccountId).toBeUndefined();
  });

  it("surfaces memberships + activeAccountId from /me", async () => {
    apiMock.GET.mockResolvedValueOnce({
      data: {
        user: { id: "u1", email: "x@example.com", firstName: "", lastName: "" },
        account: { id: "acc-1", name: "Active", role: "owner" },
        memberships: [
          { accountId: "acc-1", accountName: "Active", role: "owner" },
          { accountId: "acc-2", accountName: "Other", role: "member" }
        ],
        features: {},
        capabilities: {
          billing: false,
          notificationsSse: false,
          webPush: false
        }
      }
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useAccountSwitcher(), {
      wrapper: Wrapper
    });

    await waitFor(() => {
      expect(result.current.memberships).toHaveLength(2);
    });

    expect(result.current.activeAccountId).toBe("acc-1");
  });

  it("onSelect is a no-op when the target equals the active account", async () => {
    apiMock.GET.mockResolvedValueOnce({
      data: {
        user: { id: "u1", email: "x@example.com", firstName: "", lastName: "" },
        account: { id: "acc-1", name: "Active", role: "owner" },
        memberships: [
          { accountId: "acc-1", accountName: "Active", role: "owner" }
        ],
        features: {},
        capabilities: {
          billing: false,
          notificationsSse: false,
          webPush: false
        }
      }
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useAccountSwitcher(), {
      wrapper: Wrapper
    });

    await waitFor(() => {
      expect(result.current.activeAccountId).toBe("acc-1");
    });

    act(() => {
      result.current.onSelect("acc-1");
    });

    expect(apiMock.POST).not.toHaveBeenCalled();
  });

  it("onSelect POSTs /api/v1/accounts/switch for a different account", async () => {
    apiMock.GET.mockResolvedValueOnce({
      data: {
        user: { id: "u1", email: "x@example.com", firstName: "", lastName: "" },
        account: { id: "acc-1", name: "Active", role: "owner" },
        memberships: [
          { accountId: "acc-1", accountName: "Active", role: "owner" },
          { accountId: "acc-2", accountName: "Other", role: "member" }
        ],
        features: {},
        capabilities: {
          billing: false,
          notificationsSse: false,
          webPush: false
        }
      }
    });
    apiMock.POST.mockResolvedValueOnce({
      data: { success: true, data: { accountId: "acc-2" } }
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useAccountSwitcher(), {
      wrapper: Wrapper
    });

    await waitFor(() => {
      expect(result.current.activeAccountId).toBe("acc-1");
    });

    await act(async () => {
      result.current.onSelect("acc-2");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(apiMock.POST).toHaveBeenCalledWith("/api/v1/accounts/switch", {
        body: { accountId: "acc-2" }
      });
    });
  });
});
