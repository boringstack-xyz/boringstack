import type { ReactNode } from "react";

import {
  QueryClient,
  QueryClientProvider,
  useQuery
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMe } from "@/features/auth/Auth.queries";

import { ACCOUNTS_QUERY_KEYS } from "./Accounts.constants";
import { useInvitations } from "./Accounts.queries";
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
  apiMock.GET.mockReset();
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

  it("refreshes account data in already mounted observers after switching", async () => {
    let activeAccount = "acc-1";

    apiMock.POST.mockImplementation(() => {
      activeAccount = "acc-2";

      return Promise.resolve({ data: { data: { accountId: activeAccount } } });
    });
    const { Wrapper, client } = makeWrapper();

    client.setQueryData(["inactive-account-data"], "private acc-1");
    const observed = renderHook(
      () =>
        useQuery({
          queryKey: ACCOUNTS_QUERY_KEYS.invitations("acc-1"),
          queryFn: () => Promise.resolve(activeAccount),
          staleTime: Infinity
        }),
      { wrapper: Wrapper }
    );
    const mutation = renderHook(() => useSwitchAccount(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(observed.result.current.data).toBe("acc-1");
    });
    await act(() =>
      mutation.result.current.mutateAsync({ accountId: "acc-2" })
    );
    await waitFor(() => {
      expect(observed.result.current.data).toBe("acc-2");
    });
    expect(client.getQueryData(["inactive-account-data"])).toBeUndefined();
  });

  it("settles the session before refetching account keys across an A B A round trip", async () => {
    let serverAccount = "acc-1";
    let delayMe = false;
    let releaseMe: (() => void) | undefined;
    const reads: string[] = [];

    apiMock.POST.mockImplementation(
      (_path: string, options: { body: { accountId: string } }) => {
        serverAccount = options.body.accountId;

        return Promise.resolve({
          data: { data: { accountId: serverAccount } }
        });
      }
    );
    apiMock.GET.mockImplementation(
      async (path: string, options?: { params: { path: { id: string } } }) => {
        if (path === "/api/v1/users/me") {
          if (delayMe) {
            await new Promise<void>((resolve) => {
              releaseMe = resolve;
            });
          }

          return {
            data: {
              user: { id: "user" },
              account: { id: serverAccount },
              role: serverAccount === "acc-1" ? "owner" : "viewer"
            }
          };
        }

        const id = options?.params.path.id ?? "missing";

        reads.push(id);

        return { data: [{ id: `row-${id}`, accountId: id }] };
      }
    );
    const { Wrapper, client } = makeWrapper();

    client.setQueryDefaults(["accounts"], { staleTime: Infinity });
    const observed = renderHook(
      () => {
        const me = useMe();
        const rows = useInvitations(me.data?.account.id);

        return { me, rows };
      },
      { wrapper: Wrapper }
    );
    const mutation = renderHook(() => useSwitchAccount(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(observed.result.current.rows.data?.[0]?.accountId).toBe("acc-1");
    });

    for (const target of ["acc-2", "acc-1"]) {
      const prior = serverAccount;

      reads.length = 0;
      delayMe = true;
      releaseMe = undefined;
      let pending: Promise<unknown> | undefined;

      act(() => {
        pending = mutation.result.current.mutateAsync({ accountId: target });
      });
      await waitFor(() => {
        expect(releaseMe).toBeDefined();
      });
      expect(reads).not.toContain(prior);
      expect(
        client.getQueryData(ACCOUNTS_QUERY_KEYS.invitations(prior))
      ).toBeUndefined();
      await act(async () => {
        delayMe = false;
        releaseMe?.();
        await pending;
      });
      await waitFor(() => {
        expect(observed.result.current.rows.data?.[0]?.accountId).toBe(target);
      });
      expect(reads).toContain(target);
      expect(observed.result.current.me.data?.role).toBe(
        target === "acc-1" ? "owner" : "viewer"
      );
    }
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
