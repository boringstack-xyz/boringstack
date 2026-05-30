import type { JSX } from "react";
import { MemoryRouter } from "react-router-dom";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";

import { CAPABILITIES_QUERY_KEY } from "@/lib/api/queries/capabilities.constants";

import { AUTH_QUERY_KEYS } from "@/features/auth/Auth.constants";
import type { IMe } from "@/features/auth/Auth.types";

import BillingPage from "./BillingPage";

const meta: Meta<typeof BillingPage> = {
  title: "Features/Billing/BillingPage",
  component: BillingPage,
  parameters: {
    layout: "fullscreen"
  }
};

export default meta;

type IStory = StoryObj<typeof BillingPage>;

const ownerMe: IMe = {
  user: {
    id: "u1",
    email: "owner@example.com",
    firstName: "Ada",
    lastName: "Lovelace",
    emailVerified: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  account: { id: "acc1", name: "Personal" },
  role: "owner",
  memberships: [],
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

function withBillingState(
  me: IMe | null,
  billingEnabled: boolean
): (Story: () => JSX.Element) => JSX.Element {
  return (Story: () => JSX.Element) => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    client.setQueryData(AUTH_QUERY_KEYS.me, me);
    client.setQueryData(CAPABILITIES_QUERY_KEY, {
      features: {
        billing: { enabled: billingEnabled },
        notifications: { sse: false, webPush: false }
      }
    });

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

export const Disabled: IStory = {
  name: "Billing disabled",
  decorators: [withBillingState(ownerMe, false)]
};

export const Default = Disabled;

export const NotOwner: IStory = {
  decorators: [withBillingState({ ...ownerMe, role: "member" }, true)]
};
