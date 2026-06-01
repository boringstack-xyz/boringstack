import type { JSX } from "react";
import { MemoryRouter } from "react-router-dom";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AppPage } from "@/components/core/AppPage";

import { AUTH_QUERY_KEYS } from "@/features/auth/Auth.constants";
import type { IMe } from "@/features/auth/Auth.types";

import AppShell from "./AppShell";

const meta: Meta<typeof AppShell> = {
  title: "Components/core/AppShell",
  component: AppShell,
  parameters: {
    layout: "fullscreen"
  }
};

export default meta;

type IStory = StoryObj<typeof AppShell>;

const baseMe: IMe = {
  user: {
    id: "u1",
    email: "demo@example.com",
    firstName: "Demo",
    lastName: "User",
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

function withMe(me: IMe | null) {
  return (Story: () => JSX.Element) => {
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

export const Default: IStory = {
  args: {
    children: (
      <AppPage pageTitle='Example page' title='Page content goes here.'>
        <p className='text-muted-foreground text-sm'>Example body</p>
      </AppPage>
    )
  },
  decorators: [withMe(baseMe)]
};

export const WithoutDisplayName: IStory = {
  args: { children: "Page content goes here." },
  decorators: [withMe(null)]
};
