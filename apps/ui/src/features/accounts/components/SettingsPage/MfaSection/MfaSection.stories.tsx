import type { ReactElement } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";

import { i18n } from "@/lib/i18n/config";

import { AUTH_QUERY_KEYS } from "@/features/auth/Auth.constants";
import type { IMfaStatusResponse } from "@/features/auth/Auth.types";

import MfaSection from "./MfaSection";

/*
 * The card's UI state is driven by the `useMfaStatus()` query
 * (`AUTH_QUERY_KEYS.mfaStatus`). Seeding the cache with different
 * `{ enabled }` responses lets us render the disabled and enabled
 * states deterministically without spawning real API requests.
 *
 * The "enrolling" state (post-`/auth/mfa/setup`, pre-`/verify-setup`)
 * is interactive — it's reached by clicking the Enable button and
 * needs a live mutation round-trip. Skipped here; covered by the
 * hook + component tests instead.
 */

function buildClient(status: IMfaStatusResponse | undefined): QueryClient {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  if (status !== undefined) {
    client.setQueryData(AUTH_QUERY_KEYS.mfaStatus, status);
  }

  return client;
}

function withProviders(status: IMfaStatusResponse | undefined) {
  return (Story: () => ReactElement): ReactElement => (
    <QueryClientProvider client={buildClient(status)}>
      <I18nextProvider i18n={i18n}>
        <Story />
      </I18nextProvider>
    </QueryClientProvider>
  );
}

const meta: Meta<typeof MfaSection> = {
  title: "Features/Accounts/SettingsPage/MfaSection",
  component: MfaSection,
  parameters: { layout: "centered" }
};

export default meta;

type Story = StoryObj<typeof MfaSection>;

export const Default: Story = {
  name: "Disabled (no second factor)",
  decorators: [withProviders({ enabled: false })]
};

export const Loading: Story = {
  name: "Loading (status not yet resolved)",
  decorators: [withProviders(undefined)]
};

export const Enabled: Story = {
  name: "Enabled (TOTP active)",
  decorators: [withProviders({ enabled: true })]
};
