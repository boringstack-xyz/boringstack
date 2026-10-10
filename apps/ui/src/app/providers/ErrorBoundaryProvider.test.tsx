import * as Sentry from "@sentry/react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ErrorBoundaryProvider } from "./ErrorBoundaryProvider";

const Boom = (): never => {
  throw new Error("boom");
};

describe("ErrorBoundaryProvider", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundaryProvider>
        <div>safe content</div>
      </ErrorBoundaryProvider>
    );

    expect(screen.getByText("safe content")).toBeInTheDocument();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("renders the fallback and reports the error to Sentry when a child throws", () => {
    // React logs caught boundary errors to console.error; silence it.
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());

    render(
      <ErrorBoundaryProvider>
        <Boom />
      </ErrorBoundaryProvider>
    );

    expect(screen.queryByText("safe content")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Go to home" })
    ).toBeInTheDocument();
    expect(Sentry.captureException).toHaveBeenCalledOnce();
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ contexts: expect.anything() })
    );

    consoleSpy.mockRestore();
  });

  it("navigates to the home page from the fallback", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());
    const assign = vi.fn();
    const original = window.location;

    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign }
    });

    try {
      render(
        <ErrorBoundaryProvider>
          <Boom />
        </ErrorBoundaryProvider>
      );

      fireEvent.click(screen.getByRole("button", { name: "Go to home" }));

      expect(assign).toHaveBeenCalledWith("/");
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: original
      });
      consoleSpy.mockRestore();
    }
  });
});
