import { describe, expect, test } from "bun:test";

import { toCampaign } from "../../../src/api/admin/admin-campaign.utils";

describe("toCampaign", () => {
  test("drops the author id and keeps the fields the dashboard shows", () => {
    const campaign = toCampaign({
      id: "c-1",
      subject: "Hello",
      body: "Body",
      status: "sent",
      recipientCount: 3,
      failedCount: 1,
      createdByUserId: "op-1",
      sentAt: "2026-11-25T12:00:00.000Z",
      createdAt: "2026-11-25T11:00:00.000Z",
      updatedAt: "2026-11-25T12:00:00.000Z",
    });

    expect(campaign).toEqual({
      id: "c-1",
      subject: "Hello",
      body: "Body",
      status: "sent",
      recipientCount: 3,
      failedCount: 1,
      createdAt: "2026-11-25T11:00:00.000Z",
      sentAt: "2026-11-25T12:00:00.000Z",
    });
    expect(campaign).not.toHaveProperty("createdByUserId");
  });
});
