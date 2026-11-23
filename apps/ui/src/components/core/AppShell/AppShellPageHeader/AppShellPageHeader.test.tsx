import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppShellPageHeader } from "./AppShellPageHeader";

describe("AppShellPageHeader", () => {
  it("renders the title as the page heading with its optional eyebrow and subtitle", () => {
    render(
      <AppShellPageHeader
        eyebrow='Workspace'
        title='Projects'
        subtitle='Everything you are working on.'
      />
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Projects" })
    ).toBeInTheDocument();
    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(
      screen.getByText("Everything you are working on.")
    ).toBeInTheDocument();
  });

  it("omits the eyebrow and subtitle when they are not given", () => {
    render(<AppShellPageHeader title='Projects' />);

    expect(screen.getAllByText(/./u)).toHaveLength(1);
  });
});
