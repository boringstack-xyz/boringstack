import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/ApiError";

import { useBillingCheckout, useBillingPortal } from "./Billing.mutations";

const apiMock = vi.hoisted(() => ({
  POST: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({ apiClient: apiMock }));

function wrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

beforeEach(() => {
  apiMock.POST.mockReset();
});

describe("billing mutations", () => {
  it("creates a checkout session and returns the redirect URL", async () => {
    apiMock.POST.mockResolvedValueOnce({
      data: { url: "https://checkout.stripe.com/session" }
    });

    const { result } = renderHook(() => useBillingCheckout(), {
      wrapper: wrapper()
    });

    await act(async () => {
      const url = await result.current.mutateAsync({
        planId: 2,
        successUrl: "https://app.example.com/account/billing?checkout=success",
        cancelUrl: "https://app.example.com/account/billing?checkout=cancel"
      });

      expect(url).toBe("https://checkout.stripe.com/session");
    });

    expect(apiMock.POST).toHaveBeenCalledWith(
      "/api/v1/billing/stripe/checkout-session",
      {
        body: {
          planId: 2,
          successUrl:
            "https://app.example.com/account/billing?checkout=success",
          cancelUrl: "https://app.example.com/account/billing?checkout=cancel"
        }
      }
    );
  });

  it("throws when checkout returns an empty URL", async () => {
    apiMock.POST.mockResolvedValueOnce({ data: { url: "" } });

    const { result } = renderHook(() => useBillingCheckout(), {
      wrapper: wrapper()
    });

    await expect(
      result.current.mutateAsync({
        planId: 2,
        successUrl: "https://app.example.com/account/billing",
        cancelUrl: "https://app.example.com/account/billing"
      })
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("creates a portal session and returns the redirect URL", async () => {
    apiMock.POST.mockResolvedValueOnce({
      data: { url: "https://billing.stripe.com/portal" }
    });

    const { result } = renderHook(() => useBillingPortal(), {
      wrapper: wrapper()
    });

    await act(async () => {
      const url = await result.current.mutateAsync({
        returnUrl: "https://app.example.com/account/billing"
      });

      expect(url).toBe("https://billing.stripe.com/portal");
    });

    expect(apiMock.POST).toHaveBeenCalledWith(
      "/api/v1/billing/stripe/portal-session",
      {
        body: { returnUrl: "https://app.example.com/account/billing" }
      }
    );
  });
});
