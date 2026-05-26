import { MemoryRouter } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import type * as ReactI18Next from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import {
  AppPageHeaderProvider,
  useAppPageHeader
} from "@/components/core/AppPage";

import { AUTH_QUERY_KEYS } from "@/features/auth/Auth.constants";
import type { IMe } from "@/features/auth/Auth.types";

import ProfilePage from "./ProfilePage";

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

const me: IMe = {
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

describe("ProfilePage", () => {
  it("registers the page header and renders profile details", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    client.setQueryData(AUTH_QUERY_KEYS.me, me);

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
              <ProfilePage />
            </AppPageHeaderProvider>
          </MemoryRouter>
        </HelmetProvider>
      </QueryClientProvider>
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "accounts.profile.pageTitle"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("accounts.profile.fields.firstName")
    ).toHaveValue("Ada");
    expect(
      screen.getByLabelText("accounts.profile.fields.lastName")
    ).toHaveValue("Lovelace");
    expect(screen.getByLabelText("accounts.profile.fields.email")).toHaveValue(
      "demo@example.com"
    );
    expect(
      screen.getByRole("button", { name: "accounts.profile.save" })
    ).toBeInTheDocument();
  });
});
