import type { JSX } from "react";
import { MemoryRouter } from "react-router-dom";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";

import { now } from "@/lib/time/now";

import { NOTIFICATIONS_QUERY_KEYS } from "../../Notifications.constants";
import type { INotification } from "../../Notifications.types";
import NotificationsPage from "./NotificationsPage";

const meta: Meta<typeof NotificationsPage> = {
  title: "Features/Notifications/NotificationsPage",
  component: NotificationsPage,
  parameters: {
    layout: "fullscreen"
  }
};

export default meta;

type IStory = StoryObj<typeof NotificationsPage>;

const baseNotification: Omit<INotification, "id" | "title" | "status"> = {
  eventType: "comment.replied",
  body: "Sounds good — let's revisit Tuesday.",
  ctaUrl: null,
  ctaLabel: null,
  readAt: null,
  createdAt: now()
};

const sampleItems: INotification[] = [
  {
    ...baseNotification,
    id: "n1",
    title: "Alice replied to your comment",
    status: "unread"
  },
  {
    ...baseNotification,
    id: "n2",
    title: "Bob assigned you a task",
    body: "Review the PR before EOD.",
    ctaUrl: "/tasks/42",
    ctaLabel: "Open task",
    status: "unread"
  },
  {
    ...baseNotification,
    id: "n3",
    title: "Weekly digest is ready",
    body: "3 new events from your team this week.",
    status: "read",
    readAt: now()
  }
];

interface ISeed {
  readonly items: INotification[];
  readonly hasNext?: boolean;
  readonly isLoading?: boolean;
}

function withList(seed: ISeed) {
  return (Story: () => JSX.Element) => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    if (!seed.isLoading) {
      client.setQueryData([...NOTIFICATIONS_QUERY_KEYS.list, "all"] as const, {
        pages: [
          {
            items: seed.items,
            nextCursor: seed.hasNext === true ? "cursor-next" : null
          }
        ],
        pageParams: [undefined]
      });
    }

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
  decorators: [withList({ items: sampleItems })]
};

export const Loading: IStory = {
  decorators: [withList({ items: [], isLoading: true })]
};

export const Empty: IStory = {
  decorators: [withList({ items: [] })]
};

export const Populated: IStory = {
  decorators: [withList({ items: sampleItems })]
};

export const WithLoadMore: IStory = {
  name: "Populated · with Load More",
  decorators: [withList({ items: sampleItems, hasNext: true })]
};
