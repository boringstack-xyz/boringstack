import { MemoryRouter } from "react-router-dom";

import { render, screen } from "@testing-library/react";
import type * as ReactI18Next from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import DashboardActionItems from "./DashboardActionItems";
import { useDashboardActionItems } from "./DashboardActionItems.hooks";

vi.mock("./DashboardActionItems.hooks", () => ({
  useDashboardActionItems: vi.fn()
}));

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

describe("DashboardActionItems", () => {
  it("renders all actionable cards", () => {
    vi.mocked(useDashboardActionItems).mockReturnValue({
      className: undefined,
      items: [
        {
          id: "completeProfile",
          title: "dashboard.actions.completeProfile.title",
          body: "dashboard.actions.completeProfile.body",
          ctaLabel: "dashboard.actions.completeProfile.cta",
          href: "/account/profile"
        },
        {
          id: "pendingInvitations",
          title: "dashboard.actions.pendingInvitations.title",
          body: "dashboard.actions.pendingInvitations.body",
          ctaLabel: "dashboard.actions.pendingInvitations.cta",
          href: "/account/invitations"
        }
      ]
    });

    render(
      <MemoryRouter>
        <DashboardActionItems />
      </MemoryRouter>
    );

    expect(screen.getByTestId("dashboard-action-items")).toBeInTheDocument();
    expect(screen.getByText("dashboard.actions.title")).toBeInTheDocument();
    expect(
      screen.getByText("dashboard.actions.completeProfile.title")
    ).toBeInTheDocument();
    expect(
      screen.getByText("dashboard.actions.pendingInvitations.title")
    ).toBeInTheDocument();
  });

  it("renders nothing when no action items exist", () => {
    vi.mocked(useDashboardActionItems).mockReturnValue({
      className: undefined,
      items: []
    });

    render(
      <MemoryRouter>
        <DashboardActionItems />
      </MemoryRouter>
    );

    expect(
      screen.queryByTestId("dashboard-action-items")
    ).not.toBeInTheDocument();
  });
});
