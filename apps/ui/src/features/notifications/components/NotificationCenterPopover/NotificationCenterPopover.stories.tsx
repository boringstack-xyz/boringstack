import { MemoryRouter } from "react-router-dom";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import NotificationCenterPopover from "./NotificationCenterPopover";

const meta: Meta<typeof NotificationCenterPopover> = {
  title: "Features/Notifications/NotificationCenterPopover",
  component: NotificationCenterPopover,
  decorators: [
    (Story) => {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } }
      });

      return (
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <Story />
          </MemoryRouter>
        </QueryClientProvider>
      );
    }
  ]
};

export default meta;

type IStory = StoryObj<typeof NotificationCenterPopover>;

export const Default: IStory = {
  args: { trigger: "Open notifications" }
};
