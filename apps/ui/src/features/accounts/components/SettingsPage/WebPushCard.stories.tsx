import type { ReactElement } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";

import { CAPABILITIES_QUERY_KEY } from "@/lib/api/queries/capabilities.constants";
import type { ICapabilities } from "@/lib/api/queries/capabilities.types";
import { i18n } from "@/lib/i18n/config";

import WebPushCard from "./WebPushCard";

/*
 * The card reads two server-driven facts: `capabilities.features.notifications.webPush`
 * and the browser env (`VITE_VAPID_PUBLIC_KEY`). The browser-side `useWebPush()` hook
 * inspects `window.Notification`, `navigator.serviceWorker`, `PushManager` — all of
 * which exist in Storybook's Vite dev server, so `isSupported` is naturally `true`.
 *
 * What we can drive from the story:
 *   - Server capability via the React Query cache (`CAPABILITIES_QUERY_KEY`).
 *
 * What we can't easily fake without mocking the hook directly:
 *   - "Subscribed" state (needs a registered service worker).
 *   - "Blocked" state (needs `Notification.permission === "denied"`).
 *   - "Unsupported" state (needs `Notification`/`PushManager` removed from the
 *     global window — possible via story decorator but invasive).
 *
 * The two stories below cover the realistic dev paths: server hasn't shipped web
 * push (default) and server-side ready but the operator hasn't subscribed yet.
 */

function buildClient(capabilities: ICapabilities | null): QueryClient {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  client.setQueryData(CAPABILITIES_QUERY_KEY, capabilities);

  return client;
}

function withProviders(capabilities: ICapabilities | null) {
  return (Story: () => ReactElement): ReactElement => (
    <QueryClientProvider client={buildClient(capabilities)}>
      <I18nextProvider i18n={i18n}>
        <Story />
      </I18nextProvider>
    </QueryClientProvider>
  );
}

const noWebPushCapabilities: ICapabilities = {
  features: {
    notifications: { sse: false, webPush: false },
    billing: { enabled: false },
    ai: { enabled: false }
  },
  oauth: { providers: [] }
};

const withWebPushCapabilities: ICapabilities = {
  features: {
    notifications: { sse: true, webPush: true },
    billing: { enabled: false },
    ai: { enabled: false }
  },
  oauth: { providers: [] }
};

const meta: Meta<typeof WebPushCard> = {
  title: "Features/Accounts/SettingsPage/WebPushCard",
  component: WebPushCard,
  parameters: { layout: "centered" }
};

export default meta;

type IStory = StoryObj<typeof WebPushCard>;

export const Default: IStory = {
  name: "Server not configured for web push",
  decorators: [withProviders(noWebPushCapabilities)]
};

export const ReadyToSubscribe: IStory = {
  name: "Ready to subscribe (server + browser configured)",
  decorators: [withProviders(withWebPushCapabilities)]
};
