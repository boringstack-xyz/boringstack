import { MemoryRouter } from "react-router-dom";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PageLoading } from "./PageLoading";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key })
}));

describe("PageLoading", () => {
  it("announces the given title as a status", () => {
    render(
      <MemoryRouter>
        <PageLoading title='Opening your project' fullScreen={false} />
      </MemoryRouter>
    );

    expect(screen.getByTestId("page-loading")).toHaveAttribute(
      "aria-busy",
      "true"
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Opening your project"
    );
  });

  it("falls back to the common loading label", () => {
    render(
      <MemoryRouter>
        <PageLoading />
      </MemoryRouter>
    );

    expect(screen.getByRole("status")).toHaveTextContent("common.loading");
  });
});
