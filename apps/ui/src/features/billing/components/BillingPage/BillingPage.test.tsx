import { MemoryRouter } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import type * as ReactI18Next from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import { CAPABILITIES_QUERY_KEY } from "@/lib/api/queries/capabilities.constants";

import {
  AppPageHeaderProvider,
  useAppPageHeader
} from "@/components/core/AppPage";

import { AUTH_QUERY_KEYS } from "@/features/auth/Auth.constants";
import type { IMe } from "@/features/auth/Auth.types";

import BillingPage from "./BillingPage";

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

vi.mock("@/lib/api/client", () => ({
  apiClient: {
    GET: vi.fn().mockResolvedValue({ data: [] }),
    POST: vi.fn()
  }
}));

const me: IMe = {
  user: {
    id: "u1",
    email: "owner@example.com",
    firstName: "Ada",
    lastName: "Lovelace",
    emailVerified: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  account: { id: "acc1", name: "Personal" },
  role: "owner",
  memberships: [],
  features: {
    can_export: true,
    can_invite_team: true,
    max_seats: 10
  },
  capabilities: {
    billing: false,
    notificationsSse: false,
    webPush: false
  },
  authProviders: ["email"],
  hasPasswordLogin: true
};

describe("BillingPage", () => {
  it("registers the page header and shows disabled billing message", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    client.setQueryData(AUTH_QUERY_KEYS.me, me);
    client.setQueryData(CAPABILITIES_QUERY_KEY, {
      features: {
        billing: { enabled: false },
        notifications: { sse: false, webPush: false }
      }
    });

    function HeaderProbe() {
      const header = useAppPageHeader();

      if (header === null) {
        return null;
      }

      return <h1>{header.title}</h1>;
    }

    render(
      <QueryClientProvider client={client}>
        <HelmetProvider>
          <MemoryRouter>
            <AppPageHeaderProvider>
              <HeaderProbe />
              <BillingPage />
            </AppPageHeaderProvider>
          </MemoryRouter>
        </HelmetProvider>
      </QueryClientProvider>
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "billing.pageTitle"
      })
    ).toBeInTheDocument();
    expect(screen.getByText("billing.disabled")).toBeInTheDocument();
  });
});
