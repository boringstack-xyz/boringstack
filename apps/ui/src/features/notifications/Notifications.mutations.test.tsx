import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/ApiError";

import { NOTIFICATIONS_QUERY_KEYS } from "./Notifications.constants";
import {
  useArchiveNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead
} from "./Notifications.mutations";
import type { INotification, INotificationPage } from "./Notifications.types";

const apiMock = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  PUT: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: apiMock
}));

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return { Wrapper, client };
}

function makeNotification(
  overrides: Partial<INotification> = {}
): INotification {
  return {
    id: "n1",
    eventType: "test.event",
    title: "Title",
    body: "Body",
    ctaUrl: null,
    ctaLabel: null,
    status: "unread",
    readAt: null,
    createdAt: "2026-05-15T00:00:00.000Z",
    ...overrides
  };
}

beforeEach(() => {
  apiMock.GET.mockReset();
  apiMock.POST.mockReset();
  apiMock.PATCH.mockReset();
  apiMock.PUT.mockReset();
});

describe("useMarkNotificationRead", () => {
  it("optimistically marks a notification read and persists on success", async () => {
    const { Wrapper, client } = makeWrapper();
    const cache = {
      pages: [
        {
          items: [makeNotification({ id: "to-read", status: "unread" })],
          nextCursor: null
        } satisfies INotificationPage
      ],
      pageParams: [undefined]
    };

    client.setQueryData(
      [...NOTIFICATIONS_QUERY_KEYS.list, "all"] as const,
      cache
    );

    apiMock.PATCH.mockResolvedValueOnce({ data: undefined, response: {} });

    const { result } = renderHook(() => useMarkNotificationRead(), {
      wrapper: Wrapper
    });

    await act(async () => {
      await result.current.mutateAsync("to-read");
    });

    const updated = client.getQueryData<typeof cache>([
      ...NOTIFICATIONS_QUERY_KEYS.list,
      "all"
    ]);

    expect(updated?.pages[0]?.items[0]?.status).toBe("read");
  });

  it("rolls back on error", async () => {
    const { Wrapper, client } = makeWrapper();
    const cache = {
      pages: [
        {
          items: [makeNotification({ id: "to-read", status: "unread" })],
          nextCursor: null
        } satisfies INotificationPage
      ],
      pageParams: [undefined]
    };

    client.setQueryData(
      [...NOTIFICATIONS_QUERY_KEYS.list, "all"] as const,
      cache
    );

    apiMock.PATCH.mockRejectedValueOnce(new ApiError(500, { message: "x" }));

    const { result } = renderHook(() => useMarkNotificationRead(), {
      wrapper: Wrapper
    });

    await act(async () => {
      try {
        await result.current.mutateAsync("to-read");
      } catch {
        // expected
      }
    });

    const rolled = client.getQueryData<typeof cache>([
      ...NOTIFICATIONS_QUERY_KEYS.list,
      "all"
    ]);

    expect(rolled?.pages[0]?.items[0]?.status).toBe("unread");
  });
});

describe("useArchiveNotification", () => {
  it("optimistically archives a notification", async () => {
    const { Wrapper, client } = makeWrapper();
    const cache = {
      pages: [
        {
          items: [makeNotification({ id: "to-archive", status: "read" })],
          nextCursor: null
        } satisfies INotificationPage
      ],
      pageParams: [undefined]
    };

    client.setQueryData(
      [...NOTIFICATIONS_QUERY_KEYS.list, "all"] as const,
      cache
    );
    apiMock.PATCH.mockResolvedValueOnce({ data: undefined, response: {} });

    const { result } = renderHook(() => useArchiveNotification(), {
      wrapper: Wrapper
    });

    await act(async () => {
      await result.current.mutateAsync("to-archive");
    });

    const updated = client.getQueryData<typeof cache>([
      ...NOTIFICATIONS_QUERY_KEYS.list,
      "all"
    ]);

    expect(updated?.pages[0]?.items[0]?.status).toBe("archived");
  });
});

describe("useMarkAllNotificationsRead", () => {
  it("flips every unread to read and zeroes the unread count", async () => {
    const { Wrapper, client } = makeWrapper();
    const cache = {
      pages: [
        {
          items: [
            makeNotification({ id: "1", status: "unread" }),
            makeNotification({ id: "2", status: "unread" })
          ],
          nextCursor: null
        } satisfies INotificationPage
      ],
      pageParams: [undefined]
    };

    client.setQueryData(
      [...NOTIFICATIONS_QUERY_KEYS.list, "all"] as const,
      cache
    );
    client.setQueryData(NOTIFICATIONS_QUERY_KEYS.unreadCount, 2);
    apiMock.POST.mockResolvedValueOnce({
      data: { updated: 2 },
      response: {}
    });

    const { result } = renderHook(() => useMarkAllNotificationsRead(), {
      wrapper: Wrapper
    });

    await act(async () => {
      await result.current.mutateAsync(undefined);
    });

    const updated = client.getQueryData<typeof cache>([
      ...NOTIFICATIONS_QUERY_KEYS.list,
      "all"
    ]);

    expect(updated?.pages[0]?.items.every((i) => i.status === "read")).toBe(
      true
    );
    expect(
      client.getQueryData<number>(NOTIFICATIONS_QUERY_KEYS.unreadCount)
    ).toBe(0);
  });
});
