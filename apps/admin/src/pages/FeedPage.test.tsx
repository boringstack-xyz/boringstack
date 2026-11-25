import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_REQUEST_HEADER } from "../lib/admin-api";

import { FeedPage } from "./FeedPage";

const feedBody = {
  items: [
    {
      key: "queue-failed:email-delivery",
      title: "Failed jobs in email-delivery",
      count: 4,
    },
  ],
  timestamp: "2026-11-25T00:00:00.000Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FeedPage", () => {
  it("lists items and resolves one with the dashboard header", async () => {
    const fetchMock = vi.fn<
      (url: string, init?: RequestInit) => Promise<Response>
    >((_url, init) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            init?.method === "POST" ? { timestamp: "t" } : feedBody
          ),
          { status: 200 }
        )
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<FeedPage />);

    expect(
      await screen.findByText("Failed jobs in email-delivery")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Resolve" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Item resolved."
    );

    const post = fetchMock.mock.calls.find(
      ([, init]) => init?.method === "POST"
    );
    const [url, init] = post ?? [];

    expect(url).toBe(
      "/api/v1/admin/feed/queue-failed%3Aemail-delivery/resolve"
    );
    expect(new Headers(init?.headers).get(ADMIN_REQUEST_HEADER)).toBe("1");
    expect(init?.body).toBe("{}");
  });

  it("says when nothing needs a look", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ items: [], timestamp: "t" }), {
            status: 200,
          })
        )
      )
    );

    render(<FeedPage />);

    expect(
      await screen.findByText("Nothing needs a look.")
    ).toBeInTheDocument();
  });
});
