import type { JSX } from "react";
import { MemoryRouter } from "react-router-dom";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { DASHBOARD_QUERY_KEYS } from "@/features/dashboard/Dashboard.constants";
import type { IDashboardSummary } from "@/features/dashboard/Dashboard.types";

import DashboardPage from "./DashboardPage";

const meta: Meta<typeof DashboardPage> = {
  title: "Features/Dashboard/DashboardPage",
  component: DashboardPage,
  parameters: {
    layout: "fullscreen"
  }
};

export default meta;

type IStory = StoryObj<typeof DashboardPage>;

function withSummary(summary: IDashboardSummary | undefined) {
  return (Story: () => JSX.Element) => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    if (summary !== undefined) {
      client.setQueryData(DASHBOARD_QUERY_KEYS.summary, summary);
    }

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
  decorators: [withSummary({ totalEvents: 1247, recentActivity: [] })]
};

export const Loading: IStory = {
  decorators: [withSummary(undefined)]
};

export const Empty: IStory = {
  name: "Welcome (zero data)",
  decorators: [withSummary({ totalEvents: 0, recentActivity: [] })]
};

export const Populated: IStory = {
  decorators: [withSummary({ totalEvents: 1247, recentActivity: [] })]
};
