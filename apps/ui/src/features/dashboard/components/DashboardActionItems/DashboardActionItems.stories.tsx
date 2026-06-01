import { MemoryRouter } from "react-router-dom";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import DashboardActionItems from "./DashboardActionItems";

const meta: Meta<typeof DashboardActionItems> = {
  title: "Features/Dashboard/DashboardActionItems",
  component: DashboardActionItems,
  parameters: { layout: "padded" },
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

type IStory = StoryObj<typeof DashboardActionItems>;

export const Default: IStory = {};
