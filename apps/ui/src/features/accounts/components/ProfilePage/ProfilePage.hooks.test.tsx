import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type * as ReactI18Next from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import { AUTH_QUERY_KEYS } from "@/features/auth/Auth.constants";
import type { IMe } from "@/features/auth/Auth.types";

import { useProfilePage } from "./ProfilePage.hooks";

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

function makeWrapper(me: IMe | null) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  client.setQueryData(AUTH_QUERY_KEYS.me, me);

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const baseMe: IMe = {
  user: {
    id: "u1",
    email: "demo@example.com",
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

describe("useProfilePage", () => {
  it("returns email from useMe", () => {
    const { result } = renderHook(() => useProfilePage(), {
      wrapper: makeWrapper(baseMe)
    });

    expect(result.current.email).toBe("demo@example.com");
  });

  it("returns empty email when useMe has no data yet", () => {
    const { result } = renderHook(() => useProfilePage(), {
      wrapper: makeWrapper(null)
    });

    expect(result.current.email).toBe("");
  });
});
