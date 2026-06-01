import { MemoryRouter } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type * as ReactI18Next from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import {
  AppPageHeaderProvider,
  useAppPageHeader
} from "@/components/core/AppPage";

import DashboardPage from "./DashboardPage";

vi.mock("../DashboardActionItems/DashboardActionItems.hooks", () => ({
  useDashboardActionItems: () => ({
    className: undefined,
    items: [
      {
        id: "completeProfile",
        title: "dashboard.actions.completeProfile.title",
        body: "dashboard.actions.completeProfile.body",
        ctaLabel: "dashboard.actions.completeProfile.cta",
        href: "/account/profile"
      }
    ]
  })
}));

vi.mock("react-i18next", async () => {
  const actual = await vi.importActual<typeof ReactI18Next>("react-i18next");

  return {
    ...actual,
    useTranslation: () => ({
      t: (k: string, opts?: Record<string, unknown>) =>
        opts !== undefined ? `${k}:${JSON.stringify(opts)}` : k,
      i18n: { language: "en" }
    })
  };
});

function HeaderProbe() {
  const header = useAppPageHeader();

  if (header === null) {
    return null;
  }

  return <div data-testid='dashboard-header-probe'>{header.title}</div>;
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AppPageHeaderProvider>
          <HeaderProbe />
          <DashboardPage />
        </AppPageHeaderProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("DashboardPage", () => {
  it("registers the welcome copy as the shell page header", () => {
    renderPage();
    expect(screen.getByTestId("dashboard-header-probe")).toHaveTextContent(
      /dashboard\.welcome\.title/i
    );
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("renders the ActivityFeed", () => {
    renderPage();
    expect(screen.getByTestId("activity-feed")).toBeInTheDocument();
  });

  it("renders dashboard action items", () => {
    renderPage();
    expect(screen.getByTestId("dashboard-action-items")).toBeInTheDocument();
    expect(
      screen.getByText("dashboard.actions.completeProfile.title")
    ).toBeInTheDocument();
  });
});
