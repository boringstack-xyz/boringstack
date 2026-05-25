import { MemoryRouter } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDashboardPage } from "./DashboardPage.hooks";

const apiMock = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({ apiClient: apiMock }));

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

beforeEach(() => {
  apiMock.GET.mockReset();
  apiMock.POST.mockReset();
});

describe("useDashboardPage", () => {
  it("returns the summary data and clears isLoading when the query resolves", async () => {
    apiMock.GET.mockImplementation((path: string) => {
      if (path === "/api/v1/dashboard/summary") {
        return Promise.resolve({
          data: { totalEvents: 7, recentActivity: [] },
          response: {}
        });
      }

      if (path === "/api/v1/users/me") {
        return Promise.resolve({
          data: {
            user: {
              id: "user_123",
              email: "ada@example.com",
              firstName: "Ada",
              lastName: "Lovelace",
              emailVerified: true,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z"
            },
            account: { id: "acc_123", name: "Ada Inc" },
            role: "owner",
            memberships: [],
            features: {
              can_export: true,
              can_invite_team: true,
              max_seats: 5,
              max_widgets: 100
            },
            capabilities: {
              billing: true,
              notificationsSse: true,
              webPush: true
            }
          },
          response: {}
        });
      }

      return Promise.resolve({ data: undefined, response: {} });
    });

    const { result } = renderHook(() => useDashboardPage(), {
      wrapper: wrapper()
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.summary?.totalEvents).toBe(7);
    expect(result.current.displayName).toBe("Ada Lovelace");
  });
});
