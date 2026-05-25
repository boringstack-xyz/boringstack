import { MemoryRouter } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ResetPasswordPage from "./ResetPasswordPage";

vi.mock("@/lib/api/client", () => ({
  apiClient: {
    POST: vi.fn()
  }
}));

function renderPage(initialPath = "/reset-password") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>
        <ResetPasswordPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ResetPasswordPage", () => {
  it("shows missing-token state when no token query param exists", () => {
    renderPage();

    expect(
      screen.getByRole("heading", {
        name: "auth.resetPassword.invalidTokenTitle"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText("auth.resetPassword.missingToken")
    ).toBeInTheDocument();
  });

  it("renders password form when token query param exists", () => {
    renderPage("/reset-password?token=abc123");

    expect(
      screen.getByRole("heading", { name: "auth.resetPassword.title" })
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("auth.resetPassword.password")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "auth.resetPassword.submit" })
    ).toBeInTheDocument();
  });
});
