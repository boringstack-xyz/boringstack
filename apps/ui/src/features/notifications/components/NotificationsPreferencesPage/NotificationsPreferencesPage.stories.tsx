import type { JSX } from "react";
import { MemoryRouter } from "react-router-dom";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";

import { NOTIFICATIONS_QUERY_KEYS } from "../../Notifications.constants";
import type { INotificationPreference } from "../../Notifications.types";
import NotificationsPreferencesPage from "./NotificationsPreferencesPage";

const meta: Meta<typeof NotificationsPreferencesPage> = {
  title: "Features/Notifications/NotificationsPreferencesPage",
  component: NotificationsPreferencesPage,
  parameters: {
    layout: "fullscreen"
  }
};

export default meta;

type IStory = StoryObj<typeof NotificationsPreferencesPage>;

const samplePreferences: INotificationPreference[] = [
  { eventType: "comment.replied", channel: "in-app", enabled: true },
  { eventType: "comment.replied", channel: "email", enabled: false },
  { eventType: "task.assigned", channel: "in-app", enabled: true },
  { eventType: "task.assigned", channel: "email", enabled: true },
  { eventType: "weekly.digest", channel: "in-app", enabled: false },
  { eventType: "weekly.digest", channel: "email", enabled: true }
];

function withPreferences(
  preferences: INotificationPreference[] | undefined,
  options: { isLoading?: boolean } = {}
) {
  return (Story: () => JSX.Element) => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    if (options.isLoading !== true && preferences !== undefined) {
      client.setQueryData(NOTIFICATIONS_QUERY_KEYS.preferences, preferences);
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
  decorators: [withPreferences(samplePreferences)]
};

export const Loading: IStory = {
  decorators: [withPreferences(undefined, { isLoading: true })]
};

export const Empty: IStory = {
  decorators: [withPreferences([])]
};

export const Populated: IStory = {
  decorators: [withPreferences(samplePreferences)]
};
