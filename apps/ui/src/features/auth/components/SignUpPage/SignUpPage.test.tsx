import { MemoryRouter } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type * as ReactI18Next from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import SignUpPage from "./SignUpPage";

vi.mock("react-i18next", async () => {
  const actual = await vi.importActual<typeof ReactI18Next>("react-i18next");

  return {
    ...actual,
    useTranslation: () => ({ t: (k: string) => k, i18n: { language: "en" } })
  };
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SignUpPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("SignUpPage", () => {
  it("renders the form with email, password, and submit", () => {
    renderPage();
    expect(screen.getByLabelText(/auth\.signup\.email/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/auth\.signup\.password/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /auth\.signup\.submit/i })
    ).toBeInTheDocument();
  });

  it("links back to the login page", () => {
    renderPage();
    const link = screen.getByRole("link", { name: /auth\.signup\.signIn/i });

    expect(link).toHaveAttribute("href", "/login");
  });

  it("shows validation errors for empty submission", async () => {
    const user = userEvent.setup();

    renderPage();
    await user.click(
      screen.getByRole("button", { name: /auth\.signup\.submit/i })
    );
    expect(await screen.findAllByRole("alert")).toHaveLength(2);
  });
});
