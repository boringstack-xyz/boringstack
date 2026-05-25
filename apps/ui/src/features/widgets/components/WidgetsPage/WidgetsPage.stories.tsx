import { MemoryRouter } from "react-router-dom";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import WidgetsPage from "./WidgetsPage";

const meta: Meta<typeof WidgetsPage> = {
  title: "Features/Widgets/WidgetsPage",
  component: WidgetsPage,
  decorators: [
    (Story) => {
      const client = new QueryClient();

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

type IStory = StoryObj<typeof WidgetsPage>;

export const Default: IStory = {};
