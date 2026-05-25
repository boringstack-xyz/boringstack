import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatsSection } from "./StatsSection";

const t = (k: string): string => k;

describe("StatsSection", () => {
  it("renders a loading skeleton when isLoading is true", () => {
    render(<StatsSection isLoading={true} summary={undefined} t={t} />);
    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      "common.loading"
    );
  });

  it("renders the empty-state copy when summary is undefined and not loading", () => {
    render(<StatsSection isLoading={false} summary={undefined} t={t} />);
    expect(screen.getByText("dashboard.empty")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders the user count card when a summary is provided", () => {
    render(
      <StatsSection isLoading={false} summary={{ totalEvents: 42 }} t={t} />
    );
    expect(screen.getByText("dashboard.stats.events")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText("dashboard.empty")).not.toBeInTheDocument();
  });
});
