import { MemoryRouter } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import { i18n } from "@/lib/i18n/config";

import { AUTH_QUERY_KEYS } from "@/features/auth/Auth.constants";
import type { IMe } from "@/features/auth/Auth.types";

import { AccountSwitcher } from "./AccountSwitcher";

const switchMock = vi.hoisted(() => vi.fn());

vi.mock("../../Accounts.mutations", () => ({
  useSwitchAccount: () => ({ mutate: switchMock, isPending: false })
}));

const baseUser: IMe["user"] = {
  id: "u1",
  email: "demo@example.com",
  firstName: "Demo",
  lastName: "User",
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

const baseFeatures: IMe["features"] = {
  can_export: true,
  can_invite_team: true,
  max_seats: 10,
  max_widgets: 50
};

function renderWithMe(me: IMe | null): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  client.setQueryData(AUTH_QUERY_KEYS.me, me);

  render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <AccountSwitcher />
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>
  );
}

const solo: IMe = {
  user: baseUser,
  account: { id: "acc1", name: "Personal" },
  role: "owner",
  memberships: [{ accountId: "acc1", accountName: "Personal", role: "owner" }],
  features: baseFeatures,
  capabilities: {
    billing: false,
    notificationsSse: false,
    webPush: false
  },
  authProviders: ["email"],
  hasPasswordLogin: true
};

const dual: IMe = {
  user: baseUser,
  account: { id: "acc1", name: "Personal" },
  role: "owner",
  memberships: [
    { accountId: "acc1", accountName: "Personal", role: "owner" },
    { accountId: "acc2", accountName: "Acme", role: "admin" }
  ],
  features: baseFeatures,
  capabilities: {
    billing: false,
    notificationsSse: false,
    webPush: false
  },
  authProviders: ["email"],
  hasPasswordLogin: true
};

describe("AccountSwitcher", () => {
  it("renders nothing when the user has a single membership", () => {
    renderWithMe(solo);

    expect(screen.queryByTestId("account-switcher-trigger")).toBeNull();
  });

  it("renders a trigger when the user has 2+ memberships", () => {
    renderWithMe(dual);

    expect(screen.getByTestId("account-switcher-trigger")).toBeInTheDocument();
  });

  it("calls switchAccount when a different membership is selected", async () => {
    const user = userEvent.setup();

    switchMock.mockClear();
    renderWithMe(dual);

    await user.click(screen.getByTestId("account-switcher-trigger"));

    const items = await screen.findAllByTestId("account-switcher-item");

    await user.click(items[1]!);

    expect(switchMock).toHaveBeenCalledWith({ accountId: "acc2" });
  });

  it("does not fire switchAccount when the active membership is selected", async () => {
    const user = userEvent.setup();

    switchMock.mockClear();
    renderWithMe(dual);

    await user.click(screen.getByTestId("account-switcher-trigger"));

    const items = await screen.findAllByTestId("account-switcher-item");

    await user.click(items[0]!);

    expect(switchMock).not.toHaveBeenCalled();
  });
});
