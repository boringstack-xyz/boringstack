import { MemoryRouter } from "react-router-dom";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import ForgotPasswordPage from "./ForgotPasswordPage";

const meta: Meta<typeof ForgotPasswordPage> = {
  title: "Features/Auth/ForgotPasswordPage",
  component: ForgotPasswordPage,
  parameters: {
    layout: "fullscreen"
  },
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

type IStory = StoryObj<typeof ForgotPasswordPage>;

export const Default: IStory = {};
