import { MemoryRouter } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import type * as ReactI18Next from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import { CAPABILITIES_QUERY_KEY } from "@/lib/api/queries/capabilities.constants";
import { type IMe, SESSION_QUERY_KEYS } from "@/lib/session";

import {
  AppPageHeaderProvider,
  useAppPageHeader
} from "@/components/core/AppPage";

import { BILLING_QUERY_KEYS } from "../../Billing.constants";
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

    client.setQueryData(SESSION_QUERY_KEYS.me, me);
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

  describe("interval choice", () => {
    const FREE = {
      id: 1,
      name: "Free",
      isDefault: true,
      purchasableIntervals: ["month"] as const
    };

    function renderWithPlans(plans: readonly unknown[]) {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } }
      });

      client.setQueryData(SESSION_QUERY_KEYS.me, me);
      client.setQueryData(CAPABILITIES_QUERY_KEY, {
        features: {
          billing: { enabled: true },
          notifications: { sse: false, webPush: false }
        }
      });
      client.setQueryData(BILLING_QUERY_KEYS.plans, plans);
      client.setQueryData(BILLING_QUERY_KEYS.subscription, {
        planId: 1,
        planName: "Free",
        isDefault: true,
        status: "free",
        hasStripeSubscription: false
      });

      return render(
        <QueryClientProvider client={client}>
          <HelmetProvider>
            <AppPageHeaderProvider>
              <MemoryRouter>
                <BillingPage />
              </MemoryRouter>
            </AppPageHeaderProvider>
          </HelmetProvider>
        </QueryClientProvider>
      );
    }

    it("hides the interval choice when the plans offer one interval each", () => {
      renderWithPlans([
        FREE,
        {
          id: 2,
          name: "Pro",
          isDefault: false,
          purchasableIntervals: ["month"]
        }
      ]);

      expect(
        screen.queryByRole("group", { name: "billing.interval.label" })
      ).toBeNull();
    });

    it("shows Monthly and Yearly when a plan offers both intervals", () => {
      renderWithPlans([
        FREE,
        {
          id: 2,
          name: "Pro",
          isDefault: false,
          purchasableIntervals: ["month", "year"]
        }
      ]);

      const group = screen.getByRole("group", {
        name: "billing.interval.label"
      });

      expect(group).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "billing.interval.monthly" })
      ).toHaveAttribute("aria-pressed", "true");
      expect(
        screen.getByRole("button", { name: "billing.interval.yearly" })
      ).toHaveAttribute("aria-pressed", "false");
    });
  });
});
