import { renderHook } from "@testing-library/react";
import type * as ReactI18Next from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import { useAppPage } from "./AppPage.hooks";
import AppPageHeaderProvider from "./AppPageHeaderProvider/AppPageHeaderProvider";

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

describe("useAppPage", () => {
  it("builds the document title and registers the shell header", () => {
    const { result } = renderHook(
      () =>
        useAppPage({
          pageTitle: "Profile",
          title: "Profile",
          subtitle: "How you appear inside the app."
        }),
      {
        wrapper: AppPageHeaderProvider
      }
    );

    expect(result.current.documentTitle).toBe("Profile · app.name");
  });
});
