import { render, screen } from "@testing-library/react";
import type * as ReactI18Next from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import { AppPageHeaderProvider } from "@/components/core/AppPage";
import { useAppPageHeader } from "@/components/core/AppPage/AppPageHeader.hooks";

import AppPage from "./AppPage";

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

function HeaderProbe() {
  const header = useAppPageHeader();

  if (header === null) {
    return null;
  }

  return (
    <div data-testid='header-probe'>
      <span>{header.title}</span>
      {header.subtitle !== undefined ? <span>{header.subtitle}</span> : null}
    </div>
  );
}

describe("AppPage", () => {
  it("registers the page header in AppShell context instead of rendering it in the body", () => {
    render(
      <AppPageHeaderProvider>
        <HeaderProbe />
        <AppPage
          pageTitle='Example'
          title='Example title'
          subtitle='Example subtitle'
        >
          <p>Body content</p>
        </AppPage>
      </AppPageHeaderProvider>
    );

    expect(screen.getByText("Body content")).toBeInTheDocument();
    expect(screen.getByTestId("header-probe")).toHaveTextContent(
      "Example title"
    );
    expect(screen.getByTestId("header-probe")).toHaveTextContent(
      "Example subtitle"
    );
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });
});
