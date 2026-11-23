import { MemoryRouter } from "react-router-dom";

import { render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { describe, expect, it, vi } from "vitest";

import { StatusPage } from "./StatusPage";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key })
}));

describe("StatusPage", () => {
  it("renders the state as the page's level-1 heading", () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <StatusPage
            metaTitle='Link expired'
            kind='missing'
            title='This link has expired'
            action={{ label: "Back to sign in", to: "/login" }}
          />
        </MemoryRouter>
      </HelmetProvider>
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "This link has expired" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to sign in" })
    ).toHaveAttribute("href", "/login");
  });
});
