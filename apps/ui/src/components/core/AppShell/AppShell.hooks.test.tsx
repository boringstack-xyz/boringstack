import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import type * as ReactRouterDom from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAppShell } from "./AppShell.hooks";

const navigateMock = vi.hoisted(() => vi.fn());
const apiMock = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  PUT: vi.fn(),
  DELETE: vi.fn()
}));
const notificationStreamMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", () => ({ apiClient: apiMock }));
vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof ReactRouterDom>("react-router-dom");

  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("@/features/notifications/useNotificationStream", () => ({
  useNotificationStream: notificationStreamMock
}));

const meBody = {
  user: {
    id: "u1",
    email: "alice@example.com",
    firstName: "Alice",
    lastName: "Doe"
  },
  account: { id: "acc-1", name: "Personal", role: "owner" },
  memberships: [],
  features: {},
  capabilities: {
    billing: false,
    notificationsSse: false,
    webPush: false
  }
};

const capabilitiesBody = {
  features: {
    notifications: { sse: true, webPush: false },
    billing: { enabled: false },
    ai: { enabled: false }
  },
  oauth: { providers: [] }
};

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );

  return { Wrapper };
}

beforeEach(() => {
  apiMock.GET.mockReset();
  apiMock.POST.mockReset();
  notificationStreamMock.mockReset();
  navigateMock.mockReset();
});

describe("useAppShell", () => {
  it("returns a null user + empty displayName before /me has resolved", () => {
    apiMock.GET.mockImplementation((path: string) =>
      path === "/api/v1/capabilities/"
        ? Promise.resolve({ data: capabilitiesBody })
        : new Promise(() => undefined)
    );

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useAppShell({ className: "x", children: null }),
      {
        wrapper: Wrapper
      }
    );

    expect(result.current.user).toBeNull();
    expect(result.current.displayName).toBe("");
    expect(result.current.className).toBe("x");
    expect(typeof result.current.onLogout).toBe("function");
  });

  it("populates user + displayName once /me resolves", async () => {
    apiMock.GET.mockImplementation((path: string) =>
      Promise.resolve({
        data: path === "/api/v1/capabilities/" ? capabilitiesBody : meBody
      })
    );

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useAppShell({ children: null }), {
      wrapper: Wrapper
    });

    await waitFor(() => {
      expect(result.current.user?.id).toBe("u1");
    });

    expect(result.current.displayName.length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(notificationStreamMock).toHaveBeenCalledWith(true);
    });
  });

  it("calls /api/v1/auth/logout and navigates away on a successful logout", async () => {
    apiMock.GET.mockImplementation((path: string) =>
      Promise.resolve({
        data:
          path === "/api/v1/capabilities/"
            ? capabilitiesBody
            : {
                ...meBody,
                user: {
                  id: "u1",
                  email: "x@example.com",
                  firstName: "",
                  lastName: ""
                },
                account: { id: "acc-1", name: "P", role: "owner" }
              }
      })
    );
    apiMock.POST.mockResolvedValueOnce({ data: { success: true } });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useAppShell({ children: null }), {
      wrapper: Wrapper
    });

    await act(async () => {
      result.current.onLogout();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(apiMock.POST).toHaveBeenCalledWith("/api/v1/auth/logout");
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalled();
    });
  });
});
