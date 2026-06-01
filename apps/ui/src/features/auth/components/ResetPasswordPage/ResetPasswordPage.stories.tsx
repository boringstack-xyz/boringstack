import { MemoryRouter } from "react-router-dom";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import ResetPasswordPage from "./ResetPasswordPage";

const meta: Meta<typeof ResetPasswordPage> = {
  title: "Features/Auth/ResetPasswordPage",
  component: ResetPasswordPage,
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
          <MemoryRouter
            initialEntries={["/reset-password?token=demo-token-value"]}
          >
            <Story />
          </MemoryRouter>
        </QueryClientProvider>
      );
    }
  ]
};

export default meta;

type IStory = StoryObj<typeof ResetPasswordPage>;

export const Default: IStory = {};
