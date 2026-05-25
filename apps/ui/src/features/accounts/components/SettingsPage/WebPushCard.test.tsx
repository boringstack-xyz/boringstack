import { render, screen } from "@testing-library/react";
import type * as ReactI18Next from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import WebPushCard from "./WebPushCard";

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

vi.mock("@/hooks/useWebPush.hooks", () => ({
  useWebPush: () => ({
    isSupported: false,
    isConfigured: false,
    permission: "default",
    isSubscribed: false,
    isPending: false,
    subscribe: () => Promise.resolve(),
    unsubscribe: () => Promise.resolve()
  })
}));

vi.mock("@/lib/api/queries/useCapabilities", () => ({
  useCapabilities: () => ({
    data: {
      features: {
        notifications: { webPush: true, sse: false },
        billing: { enabled: false },
        ai: { enabled: false }
      },
      oauth: { providers: [] }
    }
  })
}));

describe("WebPushCard", () => {
  it("renders the unsupported state label when the browser doesn't support Web Push", () => {
    render(<WebPushCard />);

    expect(
      screen.getByText("accounts.settings.sections.webPush.stateUnsupported")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /webPush/i })
    ).not.toBeInTheDocument();
  });
});
