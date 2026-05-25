import { MemoryRouter } from "react-router-dom";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { NOTIFICATIONS_QUERY_KEYS } from "../../Notifications.constants";
import NotificationBell from "./NotificationBell";

const meta: Meta<typeof NotificationBell> = {
  title: "Features/Notifications/NotificationBell",
  component: NotificationBell
};

export default meta;

type IStory = StoryObj<typeof NotificationBell>;

function withSeededClient(unreadCount: number) {
  return (Story: () => React.JSX.Element) => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    client.setQueryData(NOTIFICATIONS_QUERY_KEYS.unreadCount, unreadCount);

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
  decorators: [withSeededClient(0)]
};

export const Few: IStory = {
  decorators: [withSeededClient(3)]
};

export const Many: IStory = {
  decorators: [withSeededClient(150)]
};
