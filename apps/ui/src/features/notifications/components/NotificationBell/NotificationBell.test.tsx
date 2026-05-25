import { MemoryRouter } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type * as ReactI18Next from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NOTIFICATIONS_QUERY_KEYS } from "../../Notifications.constants";
import { NotificationBell } from "./NotificationBell";

vi.mock("react-i18next", async () => {
  const actual = await vi.importActual<typeof ReactI18Next>("react-i18next");

  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) =>
        opts ? `${key}:${JSON.stringify(opts)}` : key,
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

vi.mock("@/lib/api/client", () => ({
  apiClient: apiMock
}));

function renderBell(unreadCount?: number) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  if (unreadCount !== undefined) {
    client.setQueryData(NOTIFICATIONS_QUERY_KEYS.unreadCount, unreadCount);
  }

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  apiMock.GET.mockReset();
  apiMock.GET.mockResolvedValue({
    data: { items: [], nextCursor: null },
    response: {}
  });
});

describe("NotificationBell", () => {
  it("renders without a badge when there are no unread notifications", () => {
    renderBell(0);
    expect(
      screen.getByRole("button", { name: /notifications\.bellAriaLabel/ })
    ).toBeInTheDocument();
    expect(screen.queryByText(/^\d/)).not.toBeInTheDocument();
  });

  it("renders the unread count badge", () => {
    renderBell(3);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("caps the badge at 99+", () => {
    renderBell(150);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });
});
