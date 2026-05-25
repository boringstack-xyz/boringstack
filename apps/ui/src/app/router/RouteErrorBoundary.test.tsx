import {
  type RouteObject,
  RouterProvider,
  createMemoryRouter
} from "react-router-dom";

import { render, screen, waitFor } from "@testing-library/react";
import type * as ReactI18Next from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/ApiError";

import { RouteErrorBoundary } from "./RouteErrorBoundary";

vi.mock("react-i18next", async () => {
  const actual = await vi.importActual<typeof ReactI18Next>("react-i18next");

  return {
    ...actual,
    useTranslation: () => ({
      t: (k: string) => k,
      i18n: { language: "en" }
    })
  };
});

const loggerErrorSpy = vi.fn<(...args: unknown[]) => void>();

vi.mock("@/lib/logger/logger", () => ({
  logger: {
    error: (...args: unknown[]): void => {
      loggerErrorSpy(...args);
    },
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

function renderWithError(error: unknown) {
  const routes: RouteObject[] = [
    {
      path: "/",
      element: <div>ok</div>,
      errorElement: <RouteErrorBoundary />,
      loader: () => {
        throw error;
      }
    }
  ];
  const router = createMemoryRouter(routes, { initialEntries: ["/"] });

  return render(<RouterProvider router={router} />);
}

describe("RouteErrorBoundary", () => {
  beforeEach(() => {
    loggerErrorSpy.mockClear();
  });

  it("shows the unauthorized headline when an ApiError 401 reaches the boundary", async () => {
    renderWithError(new ApiError(401, { message: "no" }));
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "errors.route.unauthorized"
      })
    ).toBeInTheDocument();
  });

  it("shows the server headline when an ApiError 500+ reaches the boundary", async () => {
    renderWithError(new ApiError(503, { message: "down" }));
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "errors.route.server"
      })
    ).toBeInTheDocument();
  });

  it("shows the generic headline for a plain Error", async () => {
    renderWithError(new Error("boom"));
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "errors.route.generic"
      })
    ).toBeInTheDocument();
  });

  it("renders retry + home actions and logs once with extracted message", async () => {
    renderWithError(new Error("boom"));
    expect(
      await screen.findByRole("button", { name: "errors.route.retry" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "errors.route.home" })
    ).toHaveAttribute("href", "/");
    await waitFor(() => {
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "ui.route_error",
          message: "boom"
        })
      );
    });
  });

  it("falls back to 'unknown' when the error isn't an Error", async () => {
    /*
     * React Router 7 wraps non-Error throws in an ErrorResponse; our
     * extractErrorMessage returns "unknown" for the non-Error / non-string case.
     */
    renderWithError({ weird: true });
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "errors.route.generic"
      })
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ message: "unknown" })
      );
    });
  });
});
