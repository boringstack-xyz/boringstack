import { MemoryRouter } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type * as ReactI18Next from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import AppSidebar from "./AppSidebar";

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

function renderSidebar(onNavigate?: () => void) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppSidebar onNavigate={onNavigate} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("AppSidebar", () => {
  it("renders the brand lockup + all non-billing nav links", () => {
    renderSidebar();

    expect(screen.getByText("app.name")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(7);
    expect(
      screen.getByRole("link", { name: /nav\.dashboard/i })
    ).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: /nav\.widgets/i })).toHaveAttribute(
      "href",
      "/widgets"
    );
    expect(
      screen.getByRole("link", { name: /nav\.settings/i })
    ).toHaveAttribute("href", "/account/settings");
  });

  it("calls onNavigate when a nav link is clicked", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    renderSidebar(onNavigate);

    await user.click(screen.getByRole("link", { name: /nav\.team/i }));
    expect(onNavigate).toHaveBeenCalled();
  });
});
