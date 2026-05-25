import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NOTIFICATIONS_QUERY_KEYS } from "./Notifications.constants";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences
} from "./Notifications.preferences.queries";

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

beforeEach(() => {
  apiMock.GET.mockReset();
  apiMock.POST.mockReset();
  apiMock.PATCH.mockReset();
  apiMock.PUT.mockReset();
});

describe("preferences queries", () => {
  it("fetches preferences", async () => {
    apiMock.GET.mockResolvedValueOnce({
      data: {
        items: [
          { eventType: "comment.replied", channel: "email", enabled: true }
        ]
      },
      response: {}
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useNotificationPreferences(), {
      wrapper: Wrapper
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.[0]?.eventType).toBe("comment.replied");
  });

  it("updates preferences and writes the result into the cache", async () => {
    const { Wrapper, client } = makeWrapper();
    const next = [
      { eventType: "comment.replied", channel: "in-app", enabled: false }
    ];

    apiMock.PUT.mockResolvedValueOnce({ data: { items: next }, response: {} });

    const { result } = renderHook(() => useUpdateNotificationPreferences(), {
      wrapper: Wrapper
    });

    await act(async () => {
      await result.current.mutateAsync(next);
    });

    expect(client.getQueryData(NOTIFICATIONS_QUERY_KEYS.preferences)).toEqual(
      next
    );
  });
});
