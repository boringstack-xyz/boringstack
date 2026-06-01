import { MemoryRouter } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ForgotPasswordPage from "./ForgotPasswordPage";

vi.mock("@/lib/api/client", () => ({
  apiClient: {
    POST: vi.fn()
  }
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ForgotPasswordPage", () => {
  it("renders the forgot password form", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "auth.forgotPassword.title" })
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("auth.forgotPassword.email")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "auth.forgotPassword.submit" })
    ).toBeInTheDocument();
  });
});
