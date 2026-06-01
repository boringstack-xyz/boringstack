import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useBillingPlans } from "./Billing.queries";

const apiMock = vi.hoisted(() => ({
  GET: vi.fn()
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
  apiMock.GET.mockReset();
});

describe("useBillingPlans", () => {
  it("loads billing plans when enabled", async () => {
    apiMock.GET.mockResolvedValueOnce({
      data: [
        { id: 1, name: "Free", isDefault: true },
        { id: 2, name: "Pro", isDefault: false }
      ]
    });

    const { result } = renderHook(() => useBillingPlans(true), {
      wrapper: wrapper()
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([
      { id: 1, name: "Free", isDefault: true },
      { id: 2, name: "Pro", isDefault: false }
    ]);
    expect(apiMock.GET).toHaveBeenCalledWith("/api/v1/billing/plans");
  });

  it("does not fetch when disabled", () => {
    renderHook(() => useBillingPlans(false), {
      wrapper: wrapper()
    });

    expect(apiMock.GET).not.toHaveBeenCalled();
  });
});
