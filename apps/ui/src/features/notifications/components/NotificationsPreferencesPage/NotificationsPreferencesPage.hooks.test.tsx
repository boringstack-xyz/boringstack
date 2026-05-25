import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useNotificationsPreferencesPage } from "./NotificationsPreferencesPage.hooks";

const apiMock = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  PUT: vi.fn(),
  DELETE: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({ apiClient: apiMock }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" }
  })
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return { Wrapper };
}

beforeEach(() => {
  apiMock.GET.mockReset();
  apiMock.PUT.mockReset();
  apiMock.POST.mockReset();
});

describe("useNotificationsPreferencesPage", () => {
  it("starts with empty rows + isLoading=true", () => {
    apiMock.GET.mockImplementation(() => new Promise(() => undefined));

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useNotificationsPreferencesPage(), {
      wrapper: Wrapper
    });

    expect(result.current.rows).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it("groups preferences into rows once the query resolves", async () => {
    apiMock.GET.mockResolvedValueOnce({
      data: {
        items: [
          { eventType: "auth.login", channel: "in-app", enabled: true },
          { eventType: "auth.login", channel: "email", enabled: false }
        ]
      }
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useNotificationsPreferencesPage(), {
      wrapper: Wrapper
    });

    await waitFor(() => {
      expect(result.current.rows).toHaveLength(1);
    });

    expect(result.current.rows[0]?.channels["in-app"]).toBe(true);
    expect(result.current.rows[0]?.channels.email).toBe(false);
  });

  it("toggle flips the cell value locally before save fires", async () => {
    apiMock.GET.mockResolvedValueOnce({
      data: {
        items: [{ eventType: "auth.login", channel: "in-app", enabled: true }]
      }
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useNotificationsPreferencesPage(), {
      wrapper: Wrapper
    });

    await waitFor(() => {
      expect(result.current.rows).toHaveLength(1);
    });

    act(() => {
      result.current.toggle("auth.login", "in-app");
    });

    await waitFor(() => {
      expect(result.current.rows[0]?.channels["in-app"]).toBe(false);
    });
  });
});
