import { MemoryRouter } from "react-router-dom";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { userEvent, within } from "storybook/test";

import SignUpPage from "./SignUpPage";

const meta: Meta<typeof SignUpPage> = {
  title: "Features/Auth/SignUpPage",
  component: SignUpPage,
  parameters: {
    layout: "fullscreen"
  },
  decorators: [
    (Story) => {
      const client = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false }
        }
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

type IStory = StoryObj<typeof SignUpPage>;

export const Default: IStory = {};

export const WithValidationErrors: IStory = {
  name: "With validation errors",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getByRole("button", { name: /create account/i })
    );
  }
};

export const FilledIn: IStory = {
  name: "Filled in",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(
      canvas.getByLabelText(/email/i),
      "new-user@example.com"
    );
    await userEvent.type(
      canvas.getByLabelText(/password/i),
      "Strong-Password-123"
    );
  }
};
