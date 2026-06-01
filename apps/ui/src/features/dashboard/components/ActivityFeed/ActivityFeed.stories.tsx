import type { JSX } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { DASHBOARD_QUERY_KEYS } from "@/features/dashboard/Dashboard.constants";
import type { IActivityPage } from "@/features/dashboard/Dashboard.types";

import ActivityFeed from "./ActivityFeed";

const meta: Meta<typeof ActivityFeed> = {
  title: "Features/Dashboard/ActivityFeed",
  component: ActivityFeed
};

export default meta;

type IStory = StoryObj<typeof ActivityFeed>;

const samplePage: IActivityPage = {
  items: [
    {
      id: "a1",
      title: "Alice signed up",
      timestamp: "2026-05-19T09:30:00.000Z"
    },
    {
      id: "a2",
      title: "Bob upgraded to Pro",
      timestamp: "2026-05-19T11:14:00.000Z"
    },
    {
      id: "a3",
      title: "Carol invited 3 teammates",
      timestamp: "2026-05-18T08:00:00.000Z"
    }
  ],
  nextCursor: null
};

function withPages(pages: IActivityPage[] | undefined) {
  return (Story: () => JSX.Element) => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    if (pages !== undefined) {
      client.setQueryData(DASHBOARD_QUERY_KEYS.activity, {
        pages,
        pageParams: [undefined]
      });
    }

    return (
      <QueryClientProvider client={client}>
        <Story />
      </QueryClientProvider>
    );
  };
}

export const Default: IStory = {
  decorators: [withPages([samplePage])]
};

export const Loading: IStory = {
  decorators: [withPages(undefined)]
};

export const Empty: IStory = {
  decorators: [withPages([{ items: [], nextCursor: null }])]
};

export const WithLoadMore: IStory = {
  name: "Populated · with Load More",
  decorators: [
    withPages([
      {
        items: samplePage.items,
        nextCursor: "cursor-next"
      }
    ])
  ]
};
