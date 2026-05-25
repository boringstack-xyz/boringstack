import { MemoryRouter } from "react-router-dom";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AUTH_QUERY_KEYS } from "@/features/auth/Auth.constants";
import type { IMe } from "@/features/auth/Auth.types";

import AccountSwitcher from "./AccountSwitcher";

const meta: Meta<typeof AccountSwitcher> = {
  title: "Features/Accounts/AccountSwitcher",
  component: AccountSwitcher
};

export default meta;

type IStory = StoryObj<typeof AccountSwitcher>;

function withMe(me: IMe | null) {
  return (Story: () => React.JSX.Element) => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    client.setQueryData(AUTH_QUERY_KEYS.me, me);

    return (
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <Story />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

const baseUser: IMe["user"] = {
  id: "u1",
  email: "demo@example.com",
  firstName: "Demo",
  lastName: "User",
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

const baseFeatures: IMe["features"] = {
  can_export: true,
  can_invite_team: true,
  max_seats: 10,
  max_widgets: 50
};

export const Default: IStory = {
  decorators: [
    withMe({
      user: baseUser,
      account: { id: "acc1", name: "Personal" },
      role: "owner",
      memberships: [
        { accountId: "acc1", accountName: "Personal", role: "owner" }
      ],
      features: baseFeatures,
      capabilities: {
        billing: false,
        notificationsSse: false,
        webPush: false
      },
      authProviders: ["email"],
      hasPasswordLogin: true
    })
  ]
};

export const MultipleMemberships: IStory = {
  decorators: [
    withMe({
      user: baseUser,
      account: { id: "acc1", name: "Personal" },
      role: "owner",
      memberships: [
        { accountId: "acc1", accountName: "Personal", role: "owner" },
        { accountId: "acc2", accountName: "Acme Corp", role: "admin" },
        { accountId: "acc3", accountName: "Side Project", role: "viewer" }
      ],
      features: baseFeatures,
      capabilities: {
        billing: false,
        notificationsSse: false,
        webPush: false
      },
      authProviders: ["email"],
      hasPasswordLogin: true
    })
  ]
};
