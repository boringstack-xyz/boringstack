import type { JSX } from "react";
import { MemoryRouter } from "react-router-dom";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import InvitationAcceptPage from "./InvitationAcceptPage";

const meta: Meta<typeof InvitationAcceptPage> = {
  title: "Features/Accounts/InvitationAcceptPage",
  component: InvitationAcceptPage,
  parameters: {
    layout: "fullscreen"
  }
};

export default meta;

type IStory = StoryObj<typeof InvitationAcceptPage>;

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
  name: "Accepting (with token, request pending)",
  decorators: [withRoute("/invitations/accept?token=demo-token-32")]
};

export const MissingToken: IStory = {
  decorators: [withRoute("/invitations/accept")]
};
