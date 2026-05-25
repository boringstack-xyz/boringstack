import { MemoryRouter } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type * as ReactI18Next from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import { AppPageTestShell } from "@/lib/test/AppPageTestShell";

import WidgetsPage from "./WidgetsPage";

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
  DELETE: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: apiMock
}));

function renderPage(): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AppPageTestShell>
          <WidgetsPage />
        </AppPageTestShell>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("WidgetsPage", () => {
  it("renders widgets returned by the API", async () => {
    apiMock.GET.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: "widget-1",
            accountId: "account-1",
            name: "Launch checklist",
            createdAt: "2026-05-24T00:00:00.000Z",
            updatedAt: "2026-05-24T00:00:00.000Z"
          }
        ]
      },
      response: {}
    });

    renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "widgets.title" })
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Launch checklist")).toBeInTheDocument();
    });
  });
});
