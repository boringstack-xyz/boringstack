import { MemoryRouter } from "react-router-dom";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, userEvent, within } from "storybook/test";

import LoginPage from "./LoginPage";

const meta: Meta<typeof LoginPage> = {
  title: "Features/Auth/LoginPage",
  component: LoginPage,
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

type IStory = StoryObj<typeof LoginPage>;

export const Default: IStory = {};

export const WithValidationErrors: IStory = {
  name: "With validation errors",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const submit = canvas.getByRole("button", { name: /sign in/i });

    await userEvent.click(submit);
    const alerts = await canvas.findAllByRole("alert");

    await expect(alerts.length).toBeGreaterThan(0);
  }
};

export const FilledIn: IStory = {
  name: "Filled in",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByLabelText(/email/i), "demo@example.com");
    await userEvent.type(canvas.getByLabelText(/password/i), "password123");
  }
};
