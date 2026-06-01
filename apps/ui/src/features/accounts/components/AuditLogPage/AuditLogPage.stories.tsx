import { MemoryRouter } from "react-router-dom";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuditLogPage } from "./AuditLogPage";

const meta: Meta<typeof AuditLogPage> = {
  title: "Features/Audit log/Page",
  component: AuditLogPage,
  decorators: [
    (Story) => {
      const client = new QueryClient({
        defaultOptions: {
          queries: { retry: false, staleTime: Infinity }
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
  ],
  parameters: {
    layout: "fullscreen"
  }
};

export default meta;

type Story = StoryObj<typeof AuditLogPage>;

export const Default: Story = {};
