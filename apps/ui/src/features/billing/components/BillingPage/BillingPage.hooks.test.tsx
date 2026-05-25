import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type * as ReactI18Next from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import { CAPABILITIES_QUERY_KEY } from "@/lib/api/queries/capabilities.constants";

import { AUTH_QUERY_KEYS } from "@/features/auth/Auth.constants";
import type { IMe } from "@/features/auth/Auth.types";

import type { IBillingPlan } from "../../Billing.types";
import { useBillingPage } from "./BillingPage.hooks";

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

const getMock = vi.fn();

vi.mock("@/lib/api/client", () => ({
  apiClient: {
    GET: (path: string) =>
      getMock(path) as Promise<{ data: IBillingPlan[] | undefined }>,
    POST: vi.fn()
  }
}));

vi.mock("@/lib/env", () => ({
  env: { VITE_PUBLIC_URL: "https://app.example.com" }
}));

function makeWrapper(
  me: IMe | null,
  capabilities: {
    features: {
      billing: { enabled: boolean };
      notifications?: { sse: boolean; webPush: boolean };
    };
  } | null
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  client.setQueryData(AUTH_QUERY_KEYS.me, me);
  client.setQueryData(CAPABILITIES_QUERY_KEY, capabilities);

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const baseMe: IMe = {
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
    max_seats: 10,
    max_widgets: 50
  },
  capabilities: {
    billing: false,
    notificationsSse: false,
    webPush: false
  },
  authProviders: ["email"],
  hasPasswordLogin: true
};

const billingEnabled = {
  features: {
    billing: { enabled: true },
    notifications: { sse: false, webPush: false }
  }
};

describe("useBillingPage", () => {
  it("returns disabled state when billing feature is off", () => {
    const { result } = renderHook(() => useBillingPage(), {
      wrapper: makeWrapper(baseMe, {
        features: {
          billing: { enabled: false },
          notifications: { sse: false, webPush: false }
        }
      })
    });

    expect(result.current.state).toBe("disabled");
  });

  it("returns not_owner state for non-owner members", () => {
    const { result } = renderHook(() => useBillingPage(), {
      wrapper: makeWrapper(
        { ...baseMe, role: "member" },
        {
          features: {
            billing: { enabled: true },
            notifications: { sse: false, webPush: false }
          }
        }
      )
    });

    expect(result.current.state).toBe("not_owner");
  });

  it("loads plans for billing-enabled owners", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/v1/billing/plans") {
        return Promise.resolve({
          data: [
            { id: 1, name: "Free", isDefault: true },
            { id: 2, name: "Pro", isDefault: false }
          ]
        });
      }

      if (path === "/api/v1/billing/subscription") {
        return Promise.resolve({
          data: {
            planId: 1,
            planName: "Free",
            isDefault: true,
            status: "free",
            hasStripeSubscription: false
          }
        });
      }

      return Promise.resolve({ data: undefined });
    });

    const { result } = renderHook(() => useBillingPage(), {
      wrapper: makeWrapper(baseMe, billingEnabled)
    });

    await waitFor(() => {
      expect(result.current.state).toBe("ready");
    });

    expect(result.current.plans).toHaveLength(2);
    expect(result.current.currentPlanName).toBe("Free");
    expect(result.current.hasActiveSubscription).toBe(false);
  });

  it("returns error state when subscription query fails", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/v1/billing/plans") {
        return Promise.resolve({
          data: [
            { id: 1, name: "Free", isDefault: true },
            { id: 2, name: "Pro", isDefault: false }
          ]
        });
      }

      if (path === "/api/v1/billing/subscription") {
        return Promise.reject(new Error("subscription unavailable"));
      }

      return Promise.resolve({ data: undefined });
    });

    const { result } = renderHook(() => useBillingPage(), {
      wrapper: makeWrapper(baseMe, billingEnabled)
    });

    await waitFor(() => {
      expect(result.current.state).toBe("error");
    });

    expect(result.current.currentPlanId).toBeNull();
    expect(result.current.errorMessage).toBe("billing.loadError");
  });
});
