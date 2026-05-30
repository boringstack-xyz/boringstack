import { MemoryRouter } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type * as ReactI18Next from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AppShell from "./AppShell";

vi.mock("react-i18next", async () => {
  const actual = await vi.importActual<typeof ReactI18Next>("react-i18next");

  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) =>
        opts ? `${key}:${JSON.stringify(opts)}` : key,
      i18n: { language: "en" }
    })
  };
});

const apiMock = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({ apiClient: apiMock }));

const capabilitiesBody = {
  features: {
    notifications: { sse: false, webPush: false },
    billing: { enabled: false },
    ai: { enabled: false }
  },
  oauth: { providers: [] }
};

function routeGet(meResponse: unknown): void {
  apiMock.GET.mockImplementation((url: string) => {
    if (url === "/api/v1/capabilities/") {
      return Promise.resolve({ data: capabilitiesBody, response: {} });
    }

    if (url === "/api/v1/users/me") {
      return Promise.resolve({ data: meResponse, response: {} });
    }

    return Promise.resolve({
      data: { items: [], nextCursor: null },
      response: {}
    });
  });
}

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

beforeEach(() => {
  apiMock.GET.mockReset();
  apiMock.POST.mockReset();
});

describe("AppShell", () => {
  it("renders its children inside a main element", () => {
    routeGet(null);
    const Wrapper = wrapper();

    render(
      <Wrapper>
        <AppShell>
          <p>Page content</p>
        </AppShell>
      </Wrapper>
    );

    expect(screen.getByTestId("appshell")).toBeInTheDocument();
    expect(screen.getByText("Page content")).toBeInTheDocument();
  });

  it("exposes a skip-to-content link that targets #main-content", () => {
    routeGet(null);
    const Wrapper = wrapper();

    render(
      <Wrapper>
        <AppShell>
          <p>Page content</p>
        </AppShell>
      </Wrapper>
    );

    const link = screen.getByRole("link", { name: /a11y\.skipToContent/i });

    expect(link).toHaveAttribute("href", "#main-content");

    const main = screen.getByRole("main");

    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toHaveAttribute("tabIndex", "-1");
  });

  it("shows the user's display name once /me resolves", async () => {
    routeGet({
      user: {
        id: "u-1",
        email: "alex@example.com",
        firstName: "Alex",
        lastName: "Grbic",
        emailVerified: true,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01"
      },
      account: { id: "acc-1", name: "Alex" },
      role: "owner",
      memberships: [{ accountId: "acc-1", accountName: "Alex", role: "owner" }],
      features: {
        can_export: true,
        can_invite_team: true,
        max_seats: 10
      },
      capabilities: {
        billing: false,
        notificationsSse: false,
        webPush: false
      }
    });
    const Wrapper = wrapper();

    render(
      <Wrapper>
        <AppShell>
          <p>x</p>
        </AppShell>
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText("Alex Grbic")).toBeInTheDocument();
    });
  });

  it("fires the logout mutation when the sign-out button is clicked", async () => {
    routeGet(null);
    apiMock.POST.mockResolvedValue({ data: undefined, response: {} });
    const Wrapper = wrapper();

    render(
      <Wrapper>
        <AppShell>
          <p>x</p>
        </AppShell>
      </Wrapper>
    );

    const button = await screen.findByRole("button", {
      name: /auth\.logout\.button/i
    });

    fireEvent.click(button);

    await waitFor(() => {
      expect(apiMock.POST).toHaveBeenCalledWith("/api/v1/auth/logout");
    });
  });
});
