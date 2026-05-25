import { MemoryRouter } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type * as ReactI18Next from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationCenterPopover } from "./NotificationCenterPopover";

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

vi.mock("@/lib/api/client", () => ({
  apiClient: apiMock
}));

function renderPopover() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <NotificationCenterPopover trigger={<button>open</button>} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  apiMock.GET.mockReset();
  apiMock.POST.mockReset();
  apiMock.PATCH.mockReset();
  apiMock.PUT.mockReset();
});

describe("NotificationCenterPopover", () => {
  it("renders fetched notifications when opened", async () => {
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

    renderPopover();
    await userEvent.click(screen.getByRole("button", { name: "open" }));

    expect(await screen.findByText("Hello")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "notifications.seeAll" })
    ).toHaveAttribute("href", "/notifications");
  });
});
