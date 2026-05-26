import { MemoryRouter } from "react-router-dom";

import { render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import type * as ReactI18Next from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppPageTestShell } from "@/lib/test/AppPageTestShell";

import SettingsPage from "./SettingsPage";

const useSettingsPageMock = vi.hoisted(() => vi.fn());

vi.mock("./SettingsPage.hooks", () => ({
  useSettingsPage: useSettingsPageMock
}));

vi.mock("./WebPushCard", () => ({
  WebPushCard: () => <article data-testid='web-push-card' />,
  default: () => <article data-testid='web-push-card' />
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

describe("SettingsPage", () => {
  beforeEach(() => {
    useSettingsPageMock.mockReturnValue({
      pageTitle: "accounts.settings.pageTitle",
      pageSubtitle: "accounts.settings.pageSubtitle",
      sections: [
        {
          id: "account",
          title: "accounts.settings.sections.account.title",
          body: "accounts.settings.sections.account.body"
        },
        {
          id: "security",
          title: "accounts.settings.sections.security.title",
          body: "accounts.settings.sections.security.body"
        },
        {
          id: "oauth",
          title: "accounts.settings.sections.oauth.title",
          body: "accounts.settings.sections.oauth.body"
        },
        {
          id: "danger",
          title: "accounts.settings.sections.danger.title",
          body: "accounts.settings.sections.danger.body"
        }
      ],
      accountRows: [
        {
          id: "accountName",
          label: "accounts.settings.fields.accountName",
          value: "Personal"
        }
      ],
      securityRows: [
        {
          id: "email",
          label: "accounts.settings.fields.email",
          value: "demo@example.com"
        }
      ],
      oauthProviders: [
        { provider: "google", isLinked: true },
        { provider: "github", isLinked: false },
        { provider: "linkedin", isLinked: true }
      ],
      registerAccountName: vi.fn(() => ({})),
      accountNameErrors: {},
      registerPassword: vi.fn(() => ({})),
      passwordErrors: {},
      isRenamingAccount: false,
      isChangingPassword: false,
      disconnectingProvider: null,
      isPasswordLoginEnabled: true,
      submitRenameAccount: vi.fn(),
      submitChangePassword: vi.fn(),
      onConnectProvider: vi.fn(),
      onDisconnectProvider: vi.fn(),
      deleteConfirmation: "",
      deleteConfirmationTarget: "Personal",
      canDeleteAccount: false,
      isDeletingAccount: false,
      isDeleteDisabled: true,
      deleteError: null,
      onDeleteConfirmationInputChange: vi.fn(),
      onDeleteAccount: vi.fn()
    });
  });

  it("renders account, security, web push, and danger sections", () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <AppPageTestShell>
            <SettingsPage />
          </AppPageTestShell>
        </MemoryRouter>
      </HelmetProvider>
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "accounts.settings.pageTitle"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText("accounts.settings.sections.account.title")
    ).toBeInTheDocument();
    expect(
      screen.getByText("accounts.settings.sections.security.title")
    ).toBeInTheDocument();
    expect(
      screen.getByText("accounts.settings.sections.oauth.title")
    ).toBeInTheDocument();
    expect(
      screen.getByText("accounts.settings.sections.danger.title")
    ).toBeInTheDocument();
    expect(screen.getByText("Personal")).toBeInTheDocument();
    expect(screen.getByText("demo@example.com")).toBeInTheDocument();
    expect(screen.getByTestId("web-push-card")).toBeInTheDocument();

    expect(screen.getByText("auth.oauth.google")).toBeInTheDocument();
    expect(screen.getByText("auth.oauth.github")).toBeInTheDocument();
    expect(screen.getByText("auth.oauth.linkedin")).toBeInTheDocument();

    const linkedinRow = screen
      .getByText("auth.oauth.linkedin")
      .closest("div")?.parentElement;
    expect(linkedinRow).not.toBeNull();
    expect(linkedinRow?.textContent).toContain(
      "accounts.settings.oauth.disconnect"
    );
  });
});
