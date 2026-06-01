import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Tokens } from "./Tokens";

describe("Tokens", () => {
  it("renders one section per token group", () => {
    render(<Tokens />);

    const groups = screen.getAllByTestId("tokens-group");

    expect(groups.length).toBeGreaterThan(0);
  });

  it("renders the canonical primary swatches", () => {
    render(<Tokens />);

    const primary = screen
      .getAllByTestId("tokens-group")
      .find((node) => node.dataset.group === "primary");

    expect(primary).toBeDefined();

    if (primary === undefined) {
      throw new Error("primary group missing");
    }

    const swatches = within(primary).getAllByTestId("tokens-swatch");

    expect(swatches.length).toBeGreaterThanOrEqual(4);
  });
});
