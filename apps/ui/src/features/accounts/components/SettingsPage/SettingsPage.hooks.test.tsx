import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";

import { renderHook } from "@testing-library/react";
import type * as ReactI18Next from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSettingsPage } from "./SettingsPage.hooks";

const useMeMock = vi.hoisted(() => vi.fn());
const useDeleteAccountMock = vi.hoisted(() => vi.fn());
const useUpdateAccountMock = vi.hoisted(() => vi.fn());
const useChangePasswordMock = vi.hoisted(() => vi.fn());
const useDisconnectOAuthMock = vi.hoisted(() => vi.fn());
const useCapabilitiesMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/Auth.queries", () => ({
  useMe: useMeMock
}));

vi.mock("../../Accounts.mutations", () => ({
  useDeleteAccount: useDeleteAccountMock,
  useUpdateAccount: useUpdateAccountMock
}));

vi.mock("@/features/auth/Auth.password.mutations", () => ({
  useChangePassword: useChangePasswordMock
}));

vi.mock("@/features/auth/Auth.oauth.mutations", () => ({
  useDisconnectOAuth: useDisconnectOAuthMock
}));

vi.mock("@/lib/api/queries/useCapabilities", () => ({
  useCapabilities: useCapabilitiesMock
}));

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

const baseMe = {
  user: {
    id: "user-1",
    email: "demo@example.com",
    firstName: "Demo",
    lastName: "User",
    emailVerified: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  account: { id: "account-1", name: "Personal" },
  role: "owner",
  memberships: [
    { accountId: "account-1", accountName: "Personal", role: "owner" }
  ],
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
  authProviders: ["google"],
  hasPasswordLogin: true
};

function wrapper({ children }: { readonly children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe("useSettingsPage", () => {
  beforeEach(() => {
    useMeMock.mockReturnValue({ data: baseMe });
    useDeleteAccountMock.mockReturnValue({
      isPending: false,
      isError: false,
      mutate: vi.fn()
    });
    useUpdateAccountMock.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn()
    });
    useChangePasswordMock.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn()
    });
    useDisconnectOAuthMock.mockReturnValue({
      mutate: vi.fn()
    });
    useCapabilitiesMock.mockReturnValue({
      data: { oauth: { providers: ["google", "github", "linkedin"] } }
    });
  });

  it("returns section keys in canonical order", () => {
    const { result } = renderHook(() => useSettingsPage(), { wrapper });

    expect(result.current.sections).toHaveLength(4);
    expect(result.current.sections.map((s) => s.id)).toEqual([
      "account",
      "security",
      "oauth",
      "danger"
    ]);
  });

  it("returns translated page-level copy", () => {
    const { result } = renderHook(() => useSettingsPage(), { wrapper });

    expect(result.current.pageTitle).toBe("accounts.settings.pageTitle");
    expect(result.current.pageSubtitle).toBe("accounts.settings.pageSubtitle");
  });

  it("maps the authenticated account into settings rows", () => {
    const { result } = renderHook(() => useSettingsPage(), { wrapper });

    expect(result.current.accountRows).toEqual([
      {
        id: "accountName",
        label: "accounts.settings.fields.accountName",
        value: "Personal"
      },
      {
        id: "role",
        label: "accounts.settings.fields.role",
        value: "accounts.settings.roles.owner"
      },
      {
        id: "workspaceCount",
        label: "accounts.settings.fields.workspaceCount",
        value: "1"
      }
    ]);
    expect(result.current.securityRows).toContainEqual({
      id: "email",
      label: "accounts.settings.fields.email",
      value: "demo@example.com"
    });
    expect(result.current.oauthProviders).toEqual([
      { provider: "google", isLinked: true },
      { provider: "github", isLinked: false },
      { provider: "linkedin", isLinked: false }
    ]);
  });

  it("marks linkedin as linked when it is in authProviders", () => {
    useMeMock.mockReturnValue({
      data: { ...baseMe, authProviders: ["linkedin"] }
    });

    const { result } = renderHook(() => useSettingsPage(), { wrapper });

    expect(result.current.oauthProviders).toContainEqual({
      provider: "linkedin",
      isLinked: true
    });
  });
});
