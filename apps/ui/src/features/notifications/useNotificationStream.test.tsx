import { MemoryRouter } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type * as ReactI18Next from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NOTIFICATIONS_QUERY_KEYS } from "./Notifications.constants";
import { useNotificationStream } from "./useNotificationStream";

vi.mock("react-i18next", async () => {
  const actual = await vi.importActual<typeof ReactI18Next>("react-i18next");

  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: { language: "en" }
    })
  };
});

const apiMock = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  PUT: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({ apiClient: apiMock }));

const toastMock = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
  toast: toastMock
}));

class FakeEventSource {
  static last: FakeEventSource | undefined;
  public onmessage: ((event: MessageEvent<string>) => void) | null = null;
  public onerror: (() => void) | null = null;
  public close = vi.fn();
  public readonly url: string;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.last = this;
  }
}

beforeEach(() => {
  apiMock.GET.mockReset();
  apiMock.GET.mockResolvedValue({
    data: {
      user: {
        id: "u-1",
        email: "x@example.com",
        firstName: "X",
        lastName: "Y",
        emailVerified: true,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01"
      },
      account: { id: "acc-1", name: "X Account" },
      role: "owner",
      memberships: [
        { accountId: "acc-1", accountName: "X Account", role: "owner" }
      ],
      features: {
        can_export: true,
        can_invite_team: true,
        max_seats: 10,
        max_widgets: 50
      },
      capabilities: {
        billing: true,
        notificationsSse: true,
        webPush: false
      }
    },
    response: {}
  });
  toastMock.mockReset();
  FakeEventSource.last = undefined;
  vi.stubGlobal("EventSource", FakeEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderStream(client: QueryClient, enabled = true) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  return renderHook(
    () => {
      useNotificationStream(enabled);
    },
    { wrapper: Wrapper }
  );
}

describe("useNotificationStream", () => {
  it("connects once the user is loaded and merges incoming messages into the cache", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    renderStream(client);

    await waitFor(() => {
      expect(FakeEventSource.last).toBeDefined();
    });

    const incoming = {
      id: "n-new",
      eventType: "test.event",
      title: "Title",
      body: "Body",
      ctaUrl: null,
      ctaLabel: null,
      status: "unread" as const,
      readAt: null,
      createdAt: "2026-05-15T00:00:00Z"
    };

    const listKey = [...NOTIFICATIONS_QUERY_KEYS.list, "all"] as const;

    client.setQueryData(listKey, {
      pages: [{ items: [], nextCursor: null }],
      pageParams: [undefined]
    });
    client.setQueryData(NOTIFICATIONS_QUERY_KEYS.unreadCount, 0);

    act(() => {
      const e = new MessageEvent("message", {
        data: JSON.stringify({
          type: "notification.created",
          notification: incoming
        })
      });

      FakeEventSource.last?.onmessage?.(e);
    });

    const cache = client.getQueryData<{
      pages: { items: (typeof incoming)[] }[];
    }>(listKey);

    expect(cache?.pages[0]?.items[0]?.id).toBe("n-new");
    expect(
      client.getQueryData<number>(NOTIFICATIONS_QUERY_KEYS.unreadCount)
    ).toBe(1);
    expect(toastMock).toHaveBeenCalled();
  });

  it("ignores malformed messages", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    renderStream(client);

    await waitFor(() => {
      expect(FakeEventSource.last).toBeDefined();
    });

    act(() => {
      const e = new MessageEvent("message", { data: "not json" });

      FakeEventSource.last?.onmessage?.(e);
    });

    expect(toastMock).not.toHaveBeenCalled();
  });

  it("does not connect when realtime notifications are disabled", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    renderStream(client, false);

    await waitFor(() => {
      expect(apiMock.GET).toHaveBeenCalled();
    });
    expect(FakeEventSource.last).toBeUndefined();
  });
});
