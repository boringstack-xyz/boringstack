import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type * as ReactI18Next from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import { CAPABILITIES_QUERY_KEY } from "@/lib/api/queries/capabilities.constants";

import { AUTH_QUERY_KEYS } from "@/features/auth/Auth.constants";
import type { IMe } from "@/features/auth/Auth.types";

import { useAppSidebar } from "./AppSidebar.hooks";

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

function makeWrapper(
  me: IMe | null,
  billingEnabled: boolean
): ({ children }: { children: ReactNode }) => ReactNode {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  client.setQueryData(AUTH_QUERY_KEYS.me, me);
  client.setQueryData(CAPABILITIES_QUERY_KEY, {
    features: {
      billing: { enabled: billingEnabled },
      notifications: { sse: false, webPush: false }
    }
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const ownerMe: IMe = {
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

describe("useAppSidebar", () => {
  it("returns six nav items when billing is hidden", () => {
    const { result } = renderHook(() => useAppSidebar({}), {
      wrapper: makeWrapper(ownerMe, false)
    });

    expect(result.current.items.map((i) => i.id)).toEqual([
      "dashboard",
      "notifications",
      "widgets",
      "team",
      "settings",
      "profile"
    ]);
  });

  it("includes billing for billing-enabled owners", () => {
    const { result } = renderHook(() => useAppSidebar({}), {
      wrapper: makeWrapper(ownerMe, true)
    });

    expect(result.current.items.map((i) => i.id)).toEqual([
      "dashboard",
      "notifications",
      "widgets",
      "team",
      "settings",
      "billing",
      "profile"
    ]);
  });

  it("returns the aria label key for the primary nav", () => {
    const { result } = renderHook(() => useAppSidebar({}), {
      wrapper: makeWrapper(ownerMe, false)
    });

    expect(result.current.ariaLabel).toBe("nav.ariaPrimary");
  });

  it("passes through className and onNavigate", () => {
    const onNavigate = vi.fn();
    const { result } = renderHook(
      () => useAppSidebar({ className: "x", onNavigate }),
      { wrapper: makeWrapper(ownerMe, false) }
    );

    expect(result.current.className).toBe("x");
    expect(result.current.onNavigate).toBe(onNavigate);
  });
});
