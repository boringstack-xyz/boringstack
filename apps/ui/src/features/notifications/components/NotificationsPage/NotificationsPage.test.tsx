import { MemoryRouter } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HelmetProvider } from "react-helmet-async";
import type * as ReactI18Next from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppPageTestShell } from "@/lib/test/AppPageTestShell";

import { NotificationsPage } from "./NotificationsPage";

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

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return render(
    <QueryClientProvider client={client}>
      <HelmetProvider>
        <MemoryRouter>
          <AppPageTestShell>
            <NotificationsPage />
          </AppPageTestShell>
        </MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  apiMock.GET.mockReset();
  apiMock.POST.mockReset();
  apiMock.PATCH.mockReset();
  apiMock.PUT.mockReset();
});

describe("NotificationsPage", () => {
  it("renders the title and a list of notifications", async () => {
    apiMock.GET.mockResolvedValue({
      data: {
        items: [
          {
            id: "n1",
            eventType: "test.event",
            title: "Hello",
            body: "Body",
            ctaUrl: null,
            ctaLabel: null,
            status: "unread",
            readAt: null,
            createdAt: "2026-05-15T00:00:00Z"
          }
        ],
        nextCursor: null
      },
      response: {}
    });

    renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "notifications.title"
    );
    expect(await screen.findByText("Hello")).toBeInTheDocument();
  });

  it("calls mark-all-read when the header button is clicked", async () => {
    apiMock.GET.mockResolvedValue({
      data: { items: [], nextCursor: null },
      response: {}
    });
    apiMock.POST.mockResolvedValue({ data: { updated: 0 }, response: {} });

    renderPage();

    await userEvent.click(
      screen.getByRole("button", { name: "notifications.markAllAsRead" })
    );

    expect(apiMock.POST).toHaveBeenCalledWith(
      "/api/v1/notifications/mark-all-read",
      {}
    );
  });
});
