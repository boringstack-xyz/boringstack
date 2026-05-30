import type { ReactElement } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import MfaSection from "./MfaSection";

const meta: Meta<typeof MfaSection> = {
  title: "Features/Accounts/SettingsPage/MfaSection",
  component: MfaSection,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => {
      const Wrapper = (): ReactElement => {
        const client = new QueryClient({
          defaultOptions: { queries: { retry: false } }
        });

        return (
          <QueryClientProvider client={client}>
            <Story />
          </QueryClientProvider>
        );
      };

      return <Wrapper />;
    }
  ]
};

export default meta;

type Story = StoryObj<typeof MfaSection>;

export const Default: Story = {};
