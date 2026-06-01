import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useAppPageHeader } from "../AppPageHeader.hooks";
import AppPageHeaderProvider from "./AppPageHeaderProvider";

function HeaderProbe() {
  const header = useAppPageHeader();

  return (
    <div data-testid='header-probe'>
      {header === null ? "empty" : header.title}
    </div>
  );
}

describe("AppPageHeaderProvider", () => {
  it("provides an empty header by default", () => {
    render(
      <AppPageHeaderProvider>
        <HeaderProbe />
      </AppPageHeaderProvider>
    );

    expect(screen.getByTestId("header-probe")).toHaveTextContent("empty");
  });
});
