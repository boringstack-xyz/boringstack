import { MemoryRouter } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useDashboardActionItems } from "./DashboardActionItems.hooks";

vi.mock("@/features/auth/Auth.queries", () => ({
  useMe: () => ({
    data: {
      user: {
        firstName: "",
        lastName: "",
        email: "a@b.com",
        emailVerified: true
      },
      account: { id: "acct-1", name: "Acme" },
      features: { can_invite_team: false, can_export: false },
      capabilities: { billing: false }
    }
  })
}));

vi.mock("@/lib/api/queries/useCapabilities", () => ({
  useCapabilities: () => ({
    data: { features: { billing: { enabled: false } } }
  })
}));

vi.mock("@/features/dashboard/Dashboard.queries", () => ({
  useDashboardPendingInvitations: () => ({ data: 0 }),
  useDashboardUnreadCount: () => ({ data: 0 })
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "en" } })
}));

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

describe("useDashboardActionItems", () => {
  it("includes a complete-profile item when the name is empty", () => {
    const { result } = renderHook(() => useDashboardActionItems({}), {
      wrapper: wrapper()
    });

    expect(
      result.current.items.some((item) => item.id === "completeProfile")
    ).toBe(true);
  });
});
