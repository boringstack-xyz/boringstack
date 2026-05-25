import { MemoryRouter } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HelmetProvider } from "react-helmet-async";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import { buildAbility } from "@/lib/acl/ability";
import { AbilityContext } from "@/lib/acl/acl.context";
import { i18n } from "@/lib/i18n/config";

import { AUTH_QUERY_KEYS } from "@/features/auth/Auth.constants";
import type { IMe } from "@/features/auth/Auth.types";

import { ACCOUNTS_QUERY_KEYS } from "../../Accounts.constants";
import type { IPendingInvitation } from "../../Accounts.types";
import { InvitationsPage } from "./InvitationsPage";

const inviteMock = vi.hoisted(() => vi.fn());
const resendMock = vi.hoisted(() => vi.fn());
const revokeMock = vi.hoisted(() => vi.fn());

vi.mock("../../Invitations.mutations", () => ({
  useInviteMember: () => ({ mutate: inviteMock, isPending: false }),
  useResendInvitation: () => ({ mutate: resendMock, isPending: false }),
  useRevokeInvitation: () => ({ mutate: revokeMock, isPending: false })
}));

const baseUser: IMe["user"] = {
  id: "u1",
  email: "demo@example.com",
  firstName: "Demo",
  lastName: "User",
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

function buildMe(overrides: Partial<IMe> = {}): IMe {
  return {
    user: baseUser,
    account: { id: "acc1", name: "Personal" },
    role: "owner",
    memberships: [
      { accountId: "acc1", accountName: "Personal", role: "owner" }
    ],
    features: {
      can_export: true,
      can_invite_team: true,
      max_seats: 10,
      max_widgets: 50
    },
    capabilities: {
      billing: false,
      notificationsSse: false,
      webPush: false
    },
    authProviders: ["email"],
    hasPasswordLogin: true,
    ...overrides
  };
}

function renderPage(
  me: IMe | null,
  invitations: IPendingInvitation[] = []
): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  client.setQueryData(AUTH_QUERY_KEYS.me, me);

  if (me !== null) {
    client.setQueryData(
      ACCOUNTS_QUERY_KEYS.invitations(me.account.id),
      invitations
    );
  }

  const ability =
    me !== null
      ? buildAbility(me.role, me.account.id, me.features)
      : buildAbility("viewer", "none", {
          can_export: false,
          can_invite_team: false,
          max_seats: 1,
          max_widgets: 5
        });

  render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <HelmetProvider>
          <AbilityContext.Provider value={ability}>
            <MemoryRouter>
              <InvitationsPage />
            </MemoryRouter>
          </AbilityContext.Provider>
        </HelmetProvider>
      </I18nextProvider>
    </QueryClientProvider>
  );
}

describe("InvitationsPage", () => {
  it("renders the invite form when can_invite_team and the role allows it", () => {
    renderPage(buildMe());

    expect(screen.getByTestId("invite-submit")).toBeInTheDocument();
  });

  it("hides the invite form when can_invite_team is false (feature gate)", () => {
    renderPage(
      buildMe({
        features: {
          can_export: true,
          can_invite_team: false,
          max_seats: 10,
          max_widgets: 50
        }
      })
    );

    expect(screen.queryByTestId("invite-submit")).toBeNull();
  });

  it("hides the invite form for viewer role even when the feature is on", () => {
    renderPage(buildMe({ role: "viewer" }));

    expect(screen.queryByTestId("invite-submit")).toBeNull();
  });

  it("renders the empty state when there are no pending invitations", () => {
    renderPage(buildMe(), []);

    expect(screen.queryByTestId("invitation-row")).toBeNull();
  });

  it("renders pending invitation rows", () => {
    renderPage(buildMe(), [
      {
        id: "i1",
        accountId: "acc1",
        email: "ada@example.com",
        roleToAssign: "admin",
        expiresAt: "2026-12-31T00:00:00.000Z"
      }
    ]);

    const rows = screen.getAllByTestId("invitation-row");

    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain("ada@example.com");
  });

  it("submits a valid invitation", async () => {
    const user = userEvent.setup();

    inviteMock.mockClear();
    renderPage(buildMe(), []);

    await user.type(screen.getByLabelText(/email/i), "new@example.com");
    await user.click(screen.getByTestId("invite-submit"));

    expect(inviteMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: "new@example.com" }),
      expect.anything()
    );
  });
});
