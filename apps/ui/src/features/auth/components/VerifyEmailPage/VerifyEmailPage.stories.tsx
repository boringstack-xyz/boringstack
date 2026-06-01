import type { JSX } from "react";
import { MemoryRouter } from "react-router-dom";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import VerifyEmailPage from "./VerifyEmailPage";

const meta: Meta<typeof VerifyEmailPage> = {
  title: "Features/Auth/VerifyEmailPage",
  component: VerifyEmailPage,
  parameters: {
    layout: "fullscreen"
  }
};

export default meta;

type IStory = StoryObj<typeof VerifyEmailPage>;

function withRoute(entry: string) {
  return (Story: () => JSX.Element) => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });

    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[entry]}>
          <Story />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

export const Default: IStory = {
  decorators: [withRoute("/verify-email?token=demo-token-32")]
};

export const Verifying: IStory = {
  name: "Verifying (with token, request pending)",
  decorators: [withRoute("/verify-email?token=demo-token-32")]
};

export const MissingToken: IStory = {
  decorators: [withRoute("/verify-email")]
};
