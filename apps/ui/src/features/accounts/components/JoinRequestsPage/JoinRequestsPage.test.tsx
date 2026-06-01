import { MemoryRouter } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import { buildAbility } from "@/lib/acl/ability";
import { AbilityContext } from "@/lib/acl/acl.context";
import { i18n } from "@/lib/i18n/config";

import { AUTH_QUERY_KEYS } from "@/features/auth/Auth.constants";
import type { IMe } from "@/features/auth/Auth.types";

import { ACCOUNTS_QUERY_KEYS } from "../../Accounts.constants";
import type { IJoinRequest } from "../../Accounts.types";
import { JoinRequestsPage } from "./JoinRequestsPage";

const approveMock = vi.hoisted(() => vi.fn());
const denyMock = vi.hoisted(() => vi.fn());

vi.mock("../../JoinRequests.mutations", () => ({
  useApproveJoinRequest: () => ({ mutate: approveMock, isPending: false }),
  useDenyJoinRequest: () => ({ mutate: denyMock, isPending: false })
}));

const baseUser: IMe["user"] = {
  id: "u1",
  email: "owner@example.com",
  firstName: "Demo",
  lastName: "User",
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

function buildMe(): IMe {
  const me: IMe = {
    user: baseUser,
    account: { id: "acc-1", name: "Acme" },
    role: "owner",
    memberships: [{ accountId: "acc-1", accountName: "Acme", role: "owner" }],
    features: {
      can_export: true,
      can_invite_team: true,
      max_seats: 10
    },
    capabilities: {
      billing: false,
      notificationsSse: false,
      webPush: false
    },
    authProviders: ["email"],
    hasPasswordLogin: true
  };

  return me;
}

function renderPage(rows: IJoinRequest[]): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  const me = buildMe();

  client.setQueryData(AUTH_QUERY_KEYS.me, me);
  client.setQueryData(ACCOUNTS_QUERY_KEYS.joinRequests("acc-1"), rows);

  render(
    <HelmetProvider>
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={client}>
          <AbilityContext.Provider
            value={buildAbility(me.role, me.account.id, me.features)}
          >
            <MemoryRouter initialEntries={["/account/requests"]}>
              <JoinRequestsPage />
            </MemoryRouter>
          </AbilityContext.Provider>
        </QueryClientProvider>
      </I18nextProvider>
    </HelmetProvider>
  );
}

describe("JoinRequestsPage", () => {
  it("renders the empty state when no pending requests exist", () => {
    renderPage([]);

    expect(screen.getByText(/no pending join requests/i)).toBeInTheDocument();
  });

  it("renders one row per pending request and skips already-decided ones", () => {
    renderPage([
      {
        id: "jr1",
        accountId: "acc-1",
        userId: "u-x",
        email: "new-hire@example.com",
        status: "pending",
        createdAt: "2026-06-01T00:00:00Z",
        decidedAt: null,
        decidedByUserId: null
      },
      {
        id: "jr2",
        accountId: "acc-1",
        userId: "u-y",
        email: "former@example.com",
        status: "approved",
        createdAt: "2026-05-30T00:00:00Z",
        decidedAt: "2026-05-31T00:00:00Z",
        decidedByUserId: "u1"
      }
    ]);

    const rows = screen.getAllByTestId("join-request-row");

    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveAttribute("data-request-id", "jr1");
  });
});
