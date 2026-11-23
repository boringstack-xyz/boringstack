import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router-dom";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EdgeState } from "./EdgeState";

function renderState(props: ComponentProps<typeof EdgeState>) {
  return render(
    <MemoryRouter>
      <EdgeState {...props} />
    </MemoryRouter>
  );
}

describe("EdgeState", () => {
  it("announces a broken or unreachable state as an alert", () => {
    renderState({ kind: "offline", title: "Can't reach the server" });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Can't reach the server"
    );
  });

  it("marks work under way as a busy status", () => {
    renderState({ kind: "loading", title: "Working on it" });

    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  });

  it("runs the primary action and renders a route action as a link", () => {
    const onClick = vi.fn();

    renderState({
      kind: "error",
      title: "Something went wrong",
      action: { label: "Try again", onClick },
      secondaryAction: { label: "Go home", to: "/dashboard" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "Go home" })).toHaveAttribute(
      "href",
      "/dashboard"
    );
  });

  it("uses a level-1 heading when the state is the whole page", () => {
    renderState({ kind: "missing", title: "Gone", headingLevel: 1 });

    expect(
      screen.getByRole("heading", { level: 1, name: "Gone" })
    ).toBeVisible();
  });
});
