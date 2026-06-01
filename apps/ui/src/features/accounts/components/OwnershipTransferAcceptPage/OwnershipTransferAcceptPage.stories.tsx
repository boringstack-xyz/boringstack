import type { JSX } from "react";
import { MemoryRouter } from "react-router-dom";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import OwnershipTransferAcceptPage from "./OwnershipTransferAcceptPage";

const meta: Meta<typeof OwnershipTransferAcceptPage> = {
  title: "Features/Accounts/OwnershipTransferAcceptPage",
  component: OwnershipTransferAcceptPage,
  parameters: {
    layout: "fullscreen"
  }
};

export default meta;

type IStory = StoryObj<typeof OwnershipTransferAcceptPage>;

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
  name: "Idle (Accept / Decline buttons visible)",
  decorators: [
    withRoute("/account/ownership-transfer/accept?token=demo-token-32")
  ]
};

export const MissingToken: IStory = {
  decorators: [withRoute("/account/ownership-transfer/accept")]
};
