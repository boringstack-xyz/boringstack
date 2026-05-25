import { MemoryRouter } from "react-router-dom";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { I18nextProvider } from "react-i18next";

import { buildAbility } from "@/lib/acl/ability";
import { AbilityContext } from "@/lib/acl/acl.context";
import { i18n } from "@/lib/i18n/config";

import { AUTH_QUERY_KEYS } from "@/features/auth/Auth.constants";
import type { IMe } from "@/features/auth/Auth.types";

import { ACCOUNTS_QUERY_KEYS } from "../../Accounts.constants";
import type { IPendingInvitation } from "../../Accounts.types";
import InvitationsPage from "./InvitationsPage";

const meta: Meta<typeof InvitationsPage> = {
  title: "Features/Accounts/InvitationsPage",
  component: InvitationsPage
};

export default meta;

type IStory = StoryObj<typeof InvitationsPage>;

const baseUser: IMe["user"] = {
  id: "u1",
  email: "demo@example.com",
  firstName: "Demo",
  lastName: "User",
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

const featuresWithInvite: IMe["features"] = {
  can_export: true,
  can_invite_team: true,
  max_seats: 10,
  max_widgets: 50
};

const me: IMe = {
  user: baseUser,
  account: { id: "acc1", name: "Personal" },
  role: "owner",
  memberships: [{ accountId: "acc1", accountName: "Personal", role: "owner" }],
  features: featuresWithInvite,
  capabilities: {
    billing: false,
    notificationsSse: false,
    webPush: false
  },
  authProviders: ["email"],
  hasPasswordLogin: true
};

function withSeed(invitations: IPendingInvitation[]) {
  return (Story: () => React.JSX.Element) => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    client.setQueryData(AUTH_QUERY_KEYS.me, me);
    client.setQueryData(
      ACCOUNTS_QUERY_KEYS.invitations(me.account.id),
      invitations
    );

    const ability = buildAbility(me.role, me.account.id, me.features);

    return (
      <QueryClientProvider client={client}>
        <I18nextProvider i18n={i18n}>
          <HelmetProvider>
            <AbilityContext.Provider value={ability}>
              <MemoryRouter>
                <Story />
              </MemoryRouter>
            </AbilityContext.Provider>
          </HelmetProvider>
        </I18nextProvider>
      </QueryClientProvider>
    );
  };
}

export const Default: IStory = {
  decorators: [withSeed([])]
};

export const Populated: IStory = {
  decorators: [
    withSeed([
      {
        id: "i1",
        accountId: me.account.id,
        email: "ada@example.com",
        roleToAssign: "admin",
        expiresAt: "2026-12-31T00:00:00.000Z"
      },
      {
        id: "i2",
        accountId: me.account.id,
        email: "linus@example.com",
        roleToAssign: "member",
        expiresAt: "2026-12-31T00:00:00.000Z"
      }
    ])
  ]
};
