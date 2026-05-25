import { MemoryRouter } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HelmetProvider } from "react-helmet-async";
import type * as ReactI18Next from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationsPreferencesPage } from "./NotificationsPreferencesPage";

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
          <NotificationsPreferencesPage />
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

describe("NotificationsPreferencesPage", () => {
  it("renders rows from the fetched preferences", async () => {
    apiMock.GET.mockResolvedValue({
      data: {
        items: [
          {
            eventType: "comment.replied",
            channel: "in-app",
            enabled: true
          },
          { eventType: "comment.replied", channel: "email", enabled: false }
        ]
      },
      response: {}
    });

    renderPage();

    expect(await screen.findByText("comment.replied")).toBeInTheDocument();
  });

  it("submits the toggled state via PUT", async () => {
    apiMock.GET.mockResolvedValue({
      data: {
        items: [
          { eventType: "comment.replied", channel: "in-app", enabled: true },
          { eventType: "comment.replied", channel: "email", enabled: false }
        ]
      },
      response: {}
    });
    apiMock.PUT.mockResolvedValue({
      data: {
        items: [
          { eventType: "comment.replied", channel: "in-app", enabled: true },
          { eventType: "comment.replied", channel: "email", enabled: true }
        ]
      },
      response: {}
    });

    renderPage();

    await screen.findByText("comment.replied");

    const emailSwitch = screen.getByRole("switch", {
      name: "comment.replied email"
    });

    await userEvent.click(emailSwitch);
    await userEvent.click(
      screen.getByRole("button", { name: "notifications.preferences.save" })
    );

    expect(apiMock.PUT).toHaveBeenCalled();
    const callBody = apiMock.PUT.mock.calls[0]?.[1] as {
      body: {
        preferences: {
          eventType: string;
          channel: string;
          enabled: boolean;
        }[];
      };
    };
    const emailPref = callBody.body.preferences.find(
      (p) => p.channel === "email"
    );

    expect(emailPref?.enabled).toBe(true);
  });
});
