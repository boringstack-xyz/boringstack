import { describe, expect, test } from "bun:test";

import { userNotificationChannel } from "../../../../src/lib/notifications/pubsub/user-notification-channel";

describe("userNotificationChannel", () => {
  test("uses the canonical 'notifications:user:<id>' shape", () => {
    expect(userNotificationChannel("u-1")).toBe("notifications:user:u-1");
  });

  test("preserves the literal user id (no normalization, no escaping)", () => {
    const userId = "00000000-0000-0000-0000-000000000001";

    expect(userNotificationChannel(userId)).toBe(
      `notifications:user:${userId}`
    );
  });

  test("returns distinct channels for distinct user ids", () => {
    expect(userNotificationChannel("a")).not.toBe(userNotificationChannel("b"));
  });
});
