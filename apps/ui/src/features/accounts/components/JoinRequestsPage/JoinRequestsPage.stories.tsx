import type { JSX } from "react";
import { MemoryRouter } from "react-router-dom";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AUTH_QUERY_KEYS } from "@/features/auth/Auth.constants";

import { ACCOUNTS_QUERY_KEYS } from "../../Accounts.constants";
import JoinRequestsPage from "./JoinRequestsPage";

const meta: Meta<typeof JoinRequestsPage> = {
  title: "Features/Accounts/JoinRequestsPage",
  component: JoinRequestsPage,
  parameters: { layout: "fullscreen" }
};

export default meta;

type IStory = StoryObj<typeof JoinRequestsPage>;

const seedMe = (client: QueryClient): void => {
  client.setQueryData(AUTH_QUERY_KEYS.me, {
    status: "authed",
    user: {
      id: "u1",
      email: "owner@example.com",
      firstName: "O",
      lastName: "Wner",
      emailVerified: true
    },
    account: { id: "acc-1", name: "Acme" },
    role: "owner",
    features: { can_invite_team: true }
  });
};

const seedRequests = (
  client: QueryClient,
  rows: readonly {
    id: string;
    accountId: string;
    userId: string;
    email: string;
    status: "pending" | "approved" | "denied";
    createdAt: string;
    decidedAt: string | null;
    decidedByUserId: string | null;
  }[]
): void => {
  client.setQueryData(ACCOUNTS_QUERY_KEYS.joinRequests("acc-1"), rows);
};

function withSeed(
  prep: (client: QueryClient) => void
): (Story: () => JSX.Element) => JSX.Element {
  return (Story) => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });

    prep(client);

    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/account/requests"]}>
          <Story />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

export const Default: IStory = {
  name: "With pending requests",
  decorators: [
    withSeed((client) => {
      seedMe(client);
      seedRequests(client, [
        {
          id: "jr1",
          accountId: "acc-1",
          userId: "u-x",
          email: "new-hire@example.com",
          status: "pending",
          createdAt: "2026-06-01T00:00:00Z",
          decidedAt: null,
          decidedByUserId: null
        }
      ]);
    })
  ]
};

export const Empty: IStory = {
  decorators: [
    withSeed((client) => {
      seedMe(client);
      seedRequests(client, []);
    })
  ]
};
