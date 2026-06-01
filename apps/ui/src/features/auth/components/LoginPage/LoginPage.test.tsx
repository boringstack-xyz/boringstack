import { MemoryRouter } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type * as ReactI18Next from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "./LoginPage";

const apiMock = vi.hoisted(() => ({
  GET: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({ apiClient: apiMock }));

vi.mock("react-i18next", async () => {
  const actual = await vi.importActual<typeof ReactI18Next>("react-i18next");

  return {
    ...actual,
    useTranslation: () => ({ t: (k: string) => k, i18n: { language: "en" } })
  };
});

beforeEach(() => {
  apiMock.GET.mockReset();
  apiMock.GET.mockResolvedValue({
    data: {
      features: {
        notifications: { sse: false, webPush: false },
        billing: { enabled: false },
        ai: { enabled: false }
      },
      oauth: { providers: [] }
    }
  });
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("LoginPage", () => {
  it("renders the form with email and password fields", () => {
    renderPage();
    expect(screen.getByLabelText("auth.login.email")).toBeInTheDocument();
    expect(screen.getByLabelText("auth.login.password")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "auth.login.forgotPassword" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "auth.login.submit" })
    ).toBeInTheDocument();
  });

  it("shows validation errors for empty submission", async () => {
    const user = userEvent.setup();

    renderPage();
    await user.click(screen.getByRole("button", { name: "auth.login.submit" }));
    expect(await screen.findAllByRole("alert")).toHaveLength(2);
  });

  it("clears validation error after typing", async () => {
    const user = userEvent.setup();

    renderPage();
    await user.click(screen.getByRole("button", { name: "auth.login.submit" }));
    const alerts = await screen.findAllByRole("alert");

    expect(alerts.length).toBeGreaterThan(0);
    await user.type(screen.getByLabelText("auth.login.email"), "a@b.com");
    await user.type(
      screen.getByLabelText("auth.login.password"),
      "longenoughpw"
    );
    expect(screen.queryByText(/please enter a valid email/i)).toBeNull();
  });

  it("renders only OAuth providers returned by server capabilities", async () => {
    apiMock.GET.mockResolvedValueOnce({
      data: {
        features: {
          notifications: { sse: false, webPush: false },
          billing: { enabled: false },
          ai: { enabled: false }
        },
        oauth: { providers: ["google"] }
      }
    });

    renderPage();

    expect(
      await screen.findByRole("button", { name: "auth.oauth.google" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "auth.oauth.github" })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "auth.oauth.linkedin" })
    ).toBeNull();
  });
});
