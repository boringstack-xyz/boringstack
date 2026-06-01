import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useNotificationsList } from "./Notifications.list.queries";
import type { INotification } from "./Notifications.types";

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

describe("useNotificationsList", () => {
  it("loads the first page on mount", async () => {
    apiMock.GET.mockResolvedValueOnce({
      data: { items: [makeNotification({ id: "n1" })], nextCursor: "p1" },
      response: {}
    });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useNotificationsList(), {
      wrapper: Wrapper
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.pages[0]?.items[0]?.id).toBe("n1");
  });
});
