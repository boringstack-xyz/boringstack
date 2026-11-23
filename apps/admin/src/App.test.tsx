import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

const queueBody = {
  queues: [
    {
      name: "email-delivery",
      counts: {
        waiting: 3,
        active: 0,
        completed: 10,
        failed: 1,
        delayed: 0,
        paused: 0,
      },
    },
  ],
  timestamp: "2026-11-23T00:00:00.000Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("shows queue counts on the first page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(queueBody), { status: 200 })
        )
      )
    );

    render(<App />);

    expect(await screen.findByText("email-delivery")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Queues" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("shows an alert when the admin API refuses the request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("{}", { status: 403 })))
    );

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Admin API answered 403"
    );
  });
});
