import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_QUERY_KEYS } from "@/features/auth/Auth.constants";
import type { IMe } from "@/features/auth/Auth.types";

import { ACCOUNTS_QUERY_KEYS } from "../../Accounts.constants";
import { useJoinRequestsPage } from "./JoinRequestsPage.hooks";

const approveMock = vi.hoisted(() => vi.fn());
const denyMock = vi.hoisted(() => vi.fn());

vi.mock("../../JoinRequests.mutations", () => ({
  useApproveJoinRequest: () => ({ mutate: approveMock, isPending: false }),
  useDenyJoinRequest: () => ({ mutate: denyMock, isPending: false })
}));

function makeWrapper(seed: (client: QueryClient) => void) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  seed(client);

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return { Wrapper };
}

beforeEach(() => {
  approveMock.mockReset();
  denyMock.mockReset();
});

const me: IMe = {
  user: {
    id: "u1",
    email: "owner@example.com",
    firstName: "Demo",
    lastName: "User",
    emailVerified: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  account: { id: "acc-1", name: "Acme" },
  role: "owner",
  memberships: [{ accountId: "acc-1", accountName: "Acme", role: "owner" }],
  features: { can_export: true, can_invite_team: true, max_seats: 10 },
  capabilities: { billing: false, notificationsSse: false, webPush: false },
  authProviders: ["email"],
  hasPasswordLogin: true
};

describe("useJoinRequestsPage", () => {
  it("returns the seeded join requests once /me + list are both warm", async () => {
    const { Wrapper } = makeWrapper((client) => {
      client.setQueryData(AUTH_QUERY_KEYS.me, me);
      client.setQueryData(ACCOUNTS_QUERY_KEYS.joinRequests("acc-1"), [
        {
          id: "jr1",
          accountId: "acc-1",
          userId: "u-x",
          email: "x@example.com",
          status: "pending",
          createdAt: "2026-06-01T00:00:00Z",
          decidedAt: null,
          decidedByUserId: null
        }
      ]);
    });

    const { result } = renderHook(() => useJoinRequestsPage(), {
      wrapper: Wrapper
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.requests).toHaveLength(1);
  });

  it("forwards onApprove to the mutation hook with the chosen requestId", () => {
    const { Wrapper } = makeWrapper((client) => {
      client.setQueryData(AUTH_QUERY_KEYS.me, me);
      client.setQueryData(ACCOUNTS_QUERY_KEYS.joinRequests("acc-1"), []);
    });

    const { result } = renderHook(() => useJoinRequestsPage(), {
      wrapper: Wrapper
    });

    result.current.onApprove("jr1");

    expect(approveMock).toHaveBeenCalledWith(
      { requestId: "jr1" },
      expect.anything()
    );
  });
});
