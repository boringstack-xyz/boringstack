import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SectionTitle } from "./SectionTitle";

describe("SectionTitle", () => {
  it("renders the section as a level-2 heading by default", () => {
    render(
      <SectionTitle
        id='notifications'
        title='Notifications'
        description='Pick your channels.'
      />
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "Notifications" })
    ).toHaveAttribute("id", "notifications");
    expect(screen.getByText("Pick your channels.")).toBeInTheDocument();
  });

  it("renders a block inside a section as a level-3 heading", () => {
    render(<SectionTitle level={3} title='Email digests' />);

    expect(
      screen.getByRole("heading", { level: 3, name: "Email digests" })
    ).toBeInTheDocument();
  });
});
