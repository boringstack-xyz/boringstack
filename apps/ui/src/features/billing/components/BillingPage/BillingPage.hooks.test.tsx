import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type * as ReactI18Next from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CAPABILITIES_QUERY_KEY } from "@/lib/api/queries/capabilities.constants";
import { type IMe, SESSION_QUERY_KEYS } from "@/lib/session";

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
const postMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", () => ({
  apiClient: {
    GET: (path: string) =>
      getMock(path) as Promise<{ data: IBillingPlan[] | undefined }>,
    POST: (path: string, init: unknown): Promise<unknown> =>
      postMock(path, init) as Promise<unknown>
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

  client.setQueryData(SESSION_QUERY_KEYS.me, me);
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
            {
              id: 1,
              name: "Free",
              isDefault: true,
              purchasableIntervals: ["month"]
            },
            {
              id: 2,
              name: "Pro",
              isDefault: false,
              purchasableIntervals: ["month", "year"]
            }
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
            {
              id: 1,
              name: "Free",
              isDefault: true,
              purchasableIntervals: ["month"]
            },
            {
              id: 2,
              name: "Pro",
              isDefault: false,
              purchasableIntervals: ["month", "year"]
            }
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

describe("useBillingPage checkout return", () => {
  const FREE_SUBSCRIPTION = {
    planId: 1,
    planName: "Free",
    isDefault: true,
    status: "free",
    hasStripeSubscription: false
  };
  const PAID_SUBSCRIPTION = {
    planId: 2,
    planName: "Pro",
    isDefault: false,
    status: "active",
    hasStripeSubscription: true
  };

  function mockSubscription(next: () => unknown) {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/v1/billing/plans") {
        return Promise.resolve({
          data: [
            {
              id: 1,
              name: "Free",
              isDefault: true,
              purchasableIntervals: ["month"]
            },
            {
              id: 2,
              name: "Pro",
              isDefault: false,
              purchasableIntervals: ["month", "year"]
            }
          ]
        });
      }

      if (path === "/api/v1/billing/subscription") {
        return Promise.resolve({ data: next() });
      }

      return Promise.resolve({ data: undefined });
    });
  }

  beforeEach(() => {
    getMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.history.replaceState({}, "", "/");
  });

  it("polls after checkout=success, confirms when the plan is paid, and strips the param", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    window.history.replaceState({}, "", "/account/billing?checkout=success");

    let calls = 0;

    mockSubscription(() => {
      calls += 1;

      return calls >= 3 ? PAID_SUBSCRIPTION : FREE_SUBSCRIPTION;
    });

    const { result } = renderHook(() => useBillingPage(), {
      wrapper: makeWrapper(baseMe, billingEnabled)
    });

    expect(result.current.checkoutOutcome).toBe("polling");
    expect(result.current.checkoutMessage).toBe("billing.checkout.pending");

    await waitFor(
      () => {
        expect(result.current.checkoutOutcome).toBe("confirmed");
      },
      { timeout: 10_000 }
    );

    expect(result.current.checkoutMessage).toBe("billing.checkout.confirmed");
    expect(window.location.search).toBe("");
  });

  it("times out with a retry action when the paid plan never arrives", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    window.history.replaceState({}, "", "/account/billing?checkout=success");
    mockSubscription(() => FREE_SUBSCRIPTION);

    const { result } = renderHook(() => useBillingPage(), {
      wrapper: makeWrapper(baseMe, billingEnabled)
    });

    await waitFor(
      () => {
        expect(result.current.checkoutOutcome).toBe("timed_out");
      },
      { timeout: 40_000 }
    );

    expect(result.current.checkoutMessage).toBe("billing.checkout.timeout");
    expect(result.current.checkoutRetryLabel).toBe("billing.checkout.retry");
    // Param kept so a reload can still re-check.
    expect(window.location.search).toBe("?checkout=success");
  }, 60_000);

  it("shows a neutral cancel notice and removes the param without polling", async () => {
    window.history.replaceState({}, "", "/account/billing?checkout=cancel");
    mockSubscription(() => FREE_SUBSCRIPTION);

    const { result } = renderHook(() => useBillingPage(), {
      wrapper: makeWrapper(baseMe, billingEnabled)
    });

    expect(result.current.checkoutOutcome).toBe("cancelled");
    expect(result.current.checkoutMessage).toBe("billing.checkout.cancelled");
    await waitFor(() => {
      expect(window.location.search).toBe("");
    });
  });

  it("shows no checkout notice without a checkout param", () => {
    mockSubscription(() => FREE_SUBSCRIPTION);

    const { result } = renderHook(() => useBillingPage(), {
      wrapper: makeWrapper(baseMe, billingEnabled)
    });

    expect(result.current.checkoutOutcome).toBe("idle");
    expect(result.current.checkoutMessage).toBeNull();
  });
});

describe("useBillingPage interval choice", () => {
  const FREE_PLAN = {
    id: 1,
    name: "Free",
    isDefault: true,
    purchasableIntervals: ["month"]
  } as const;
  const PRO_MONTH_ONLY = {
    id: 2,
    name: "Pro",
    isDefault: false,
    purchasableIntervals: ["month"]
  } as const;
  const PRO_MONTH_AND_YEAR = {
    id: 2,
    name: "Pro",
    isDefault: false,
    purchasableIntervals: ["month", "year"]
  } as const;

  const FREE_SUBSCRIPTION = {
    planId: 1,
    planName: "Free",
    isDefault: true,
    status: "free",
    hasStripeSubscription: false
  };

  function mockPlans(plans: readonly unknown[]) {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/v1/billing/plans") {
        return Promise.resolve({ data: plans });
      }

      if (path === "/api/v1/billing/subscription") {
        return Promise.resolve({ data: FREE_SUBSCRIPTION });
      }

      return Promise.resolve({ data: undefined });
    });
  }

  function renderPage(plans: readonly unknown[]) {
    mockPlans(plans);
    postMock.mockReset();
    // Checkout stays pending so the test only inspects the request body.
    postMock.mockReturnValue(new Promise(() => undefined));

    return renderHook(() => useBillingPage(), {
      wrapper: makeWrapper(baseMe, billingEnabled)
    });
  }

  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
  });

  async function checkoutBody(result: {
    current: { onUpgrade: (planId: number) => void };
  }): Promise<Record<string, unknown>> {
    act(() => {
      result.current.onUpgrade(2);
    });

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledTimes(1);
    });

    const [, init] = postMock.mock.calls[0] ?? [];

    return (init as { body: Record<string, unknown> }).body;
  }

  it("hides the interval choice when every plan offers a single interval", async () => {
    const { result } = renderPage([FREE_PLAN, PRO_MONTH_ONLY]);

    await waitFor(() => {
      expect(result.current.state).toBe("ready");
    });

    expect(result.current.showIntervalChoice).toBe(false);
  });

  it("shows Monthly and Yearly when a plan offers two intervals, defaulting to monthly", async () => {
    const { result } = renderPage([FREE_PLAN, PRO_MONTH_AND_YEAR]);

    await waitFor(() => {
      expect(result.current.state).toBe("ready");
    });

    expect(result.current.showIntervalChoice).toBe(true);
    expect(result.current.intervalOptions.map((o) => o.label)).toEqual([
      "billing.interval.monthly",
      "billing.interval.yearly"
    ]);
    expect(result.current.intervalOptions.map((o) => o.isSelected)).toEqual([
      true,
      false
    ]);
  });

  it("sends the chosen yearly interval with checkout", async () => {
    const { result } = renderPage([FREE_PLAN, PRO_MONTH_AND_YEAR]);

    await waitFor(() => {
      expect(result.current.state).toBe("ready");
    });

    act(() => {
      result.current.intervalOptions[1]?.onSelect();
    });

    expect(result.current.intervalOptions[1]?.isSelected).toBe(true);

    const body = await checkoutBody(result);

    expect(body).toMatchObject({ planId: 2, interval: "year" });
  });

  it("sends the monthly interval when the choice was never changed", async () => {
    const { result } = renderPage([FREE_PLAN, PRO_MONTH_AND_YEAR]);

    await waitFor(() => {
      expect(result.current.state).toBe("ready");
    });

    const body = await checkoutBody(result);

    expect(body).toMatchObject({ planId: 2, interval: "month" });
  });

  it("sends no interval field for a single-interval plan", async () => {
    const { result } = renderPage([FREE_PLAN, PRO_MONTH_ONLY]);

    await waitFor(() => {
      expect(result.current.state).toBe("ready");
    });

    const body = await checkoutBody(result);

    expect(Object.keys(body)).not.toContain("interval");
    expect(body).toMatchObject({ planId: 2 });
  });
});
