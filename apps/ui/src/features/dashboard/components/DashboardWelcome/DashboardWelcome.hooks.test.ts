import { renderHook } from "@testing-library/react";
import type * as ReactI18Next from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import { useDashboardWelcome } from "./DashboardWelcome.hooks";

vi.mock("react-i18next", async () => {
  const actual = await vi.importActual<typeof ReactI18Next>("react-i18next");

  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) =>
        opts !== undefined ? `${key}:${JSON.stringify(opts)}` : key,
      i18n: { language: "en" }
    })
  };
});

describe("useDashboardWelcome", () => {
  it("returns returning-user subline when no action items are pending", () => {
    const { result } = renderHook(() =>
      useDashboardWelcome({ displayName: "Ada Lovelace" })
    );

    expect(result.current.eyebrow).toBe("dashboard.welcome.eyebrow");
    expect(result.current.title).toBe(
      'dashboard.welcome.title:{"displayName":"Ada Lovelace"}'
    );
    expect(result.current.subline).toBe("dashboard.welcome.subline.ready");
  });

  it("returns setup subline when action items are pending", () => {
    const { result } = renderHook(() =>
      useDashboardWelcome({
        displayName: "Ada Lovelace",
        hasActionItems: true
      })
    );

    expect(result.current.subline).toBe("dashboard.welcome.subline.setup");
  });

  it("falls back to translated display name when the provided one is blank", () => {
    const { result } = renderHook(() =>
      useDashboardWelcome({ displayName: " " })
    );

    expect(result.current.title).toBe(
      'dashboard.welcome.title:{"displayName":"dashboard.welcome.defaultName"}'
    );
  });

  it("passes through the className prop", () => {
    const { result } = renderHook(() =>
      useDashboardWelcome({ className: "extra", displayName: "Ada" })
    );

    expect(result.current.className).toBe("extra");
  });
});
