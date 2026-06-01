import { render, screen } from "@testing-library/react";
import type * as ReactI18Next from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCookieConsentStore } from "../CookieConsent.store";
import { CookieConsentBanner } from "./CookieConsentBanner";

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

describe("CookieConsentBanner", () => {
  beforeEach(() => {
    useCookieConsentStore.getState().reset();
    localStorage.removeItem("bs.cookie-consent.v1");
  });

  it("renders the bottom banner when consent is unset", () => {
    render(<CookieConsentBanner />);

    expect(
      screen.getByRole("region", { name: "consent.banner.ariaLabel" })
    ).toBeInTheDocument();
    expect(screen.getByText("consent.banner.acceptAll")).toBeInTheDocument();
    expect(screen.getByText("consent.banner.reject")).toBeInTheDocument();
    expect(screen.getByText("consent.banner.configure")).toBeInTheDocument();
  });

  it("renders nothing once consent has been configured", () => {
    useCookieConsentStore.getState().rejectNonEssential();

    render(<CookieConsentBanner />);

    expect(screen.queryByRole("region")).toBeNull();
  });
});
