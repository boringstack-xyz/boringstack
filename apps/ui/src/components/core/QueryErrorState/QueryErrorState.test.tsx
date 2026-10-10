import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { QueryErrorState } from "./QueryErrorState";

describe("QueryErrorState", () => {
  it("shows the message as an alert with a retry button", () => {
    const onRetry = vi.fn();

    render(
      <QueryErrorState
        message='Could not load things.'
        retryLabel='Try again'
        onRetry={onRetry}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not load things."
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("disables the retry button while a retry is in flight", () => {
    render(
      <QueryErrorState
        message='Could not load things.'
        retryLabel='Try again'
        onRetry={vi.fn()}
        isRetrying
      />
    );

    expect(screen.getByRole("button", { name: "Try again" })).toBeDisabled();
  });
});
