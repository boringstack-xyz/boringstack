import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CampaignsPage } from "./CampaignsPage";

const campaignsBody = {
  campaigns: [
    {
      id: "c-1",
      subject: "Spring news",
      body: "Hello",
      status: "sent",
      recipientCount: 2,
      failedCount: 0,
      createdAt: "2026-11-24T00:00:00.000Z",
      sentAt: "2026-11-24T01:00:00.000Z",
    },
  ],
  timestamp: "2026-11-25T00:00:00.000Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CampaignsPage", () => {
  it("lists campaigns and shows the compose form", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(campaignsBody), { status: 200 })
        )
      )
    );

    render(<CampaignsPage />);

    expect(await screen.findByText("Spring news")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save draft" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Preview" })).toBeNull();
  });
});
