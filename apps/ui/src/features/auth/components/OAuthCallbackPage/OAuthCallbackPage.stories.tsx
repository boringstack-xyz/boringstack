import type { JSX } from "react";
import { MemoryRouter } from "react-router-dom";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import OAuthCallbackPage from "./OAuthCallbackPage";

const meta: Meta<typeof OAuthCallbackPage> = {
  title: "Features/Auth/OAuthCallbackPage",
  component: OAuthCallbackPage,
  parameters: {
    layout: "fullscreen"
  }
};

export default meta;

type IStory = StoryObj<typeof OAuthCallbackPage>;

function withRoute(entry: string) {
  return (Story: () => JSX.Element) => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } }
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
  decorators: [withRoute("/oauth/callback?code=demo&state=x")]
};

export const Exchanging: IStory = {
  name: "Exchanging (spinner)",
  decorators: [withRoute("/oauth/callback?code=demo&state=x")]
};

export const WithErrorParam: IStory = {
  name: "With ?error= param",
  decorators: [withRoute("/oauth/callback?error=access_denied")]
};
