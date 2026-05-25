import type { JSX } from "react";
import { MemoryRouter } from "react-router-dom";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";

import { AUTH_QUERY_KEYS } from "@/features/auth/Auth.constants";
import type { IMe } from "@/features/auth/Auth.types";

import ProfilePage from "./ProfilePage";

const meta: Meta<typeof ProfilePage> = {
  title: "Features/Accounts/ProfilePage",
  component: ProfilePage,
  parameters: {
    layout: "fullscreen"
  }
};

export default meta;

type IStory = StoryObj<typeof ProfilePage>;

const baseMe: IMe = {
  user: {
    id: "u1",
    email: "demo@example.com",
    firstName: "Ada",
    lastName: "Lovelace",
    emailVerified: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  account: { id: "acc1", name: "Personal" },
  role: "owner",
  memberships: [{ accountId: "acc1", accountName: "Personal", role: "owner" }],
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
  hasPasswordLogin: true
};

function withMe(me: IMe | null) {
  return (Story: () => JSX.Element) => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    client.setQueryData(AUTH_QUERY_KEYS.me, me);

    return (
      <QueryClientProvider client={client}>
        <HelmetProvider>
          <MemoryRouter>
            <Story />
          </MemoryRouter>
        </HelmetProvider>
      </QueryClientProvider>
    );
  };
}

export const Default: IStory = {
  decorators: [withMe(baseMe)]
};

export const EmailOnly: IStory = {
  name: "Email-only (no name set)",
  decorators: [
    withMe({
      ...baseMe,
      user: { ...baseMe.user, firstName: "", lastName: "" }
    })
  ]
};
