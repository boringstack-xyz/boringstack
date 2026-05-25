import { describe, expect, test } from "bun:test";
import {
  expirationToIso,
  toPublicPushSubscription,
} from "../../../src/api/notifications/notifications.push.utils";
import type { IPushSubscriptionRow } from "../../../src/api/notifications/notifications.push.types";

describe("expirationToIso", () => {
  test("returns null when undefined", () => {
    expect(expirationToIso(undefined)).toBeNull();
  });

  test("returns null when explicit null", () => {
    expect(expirationToIso(null)).toBeNull();
  });

  test("converts a millisecond epoch to an ISO string", () => {
    expect(expirationToIso(0)).toBe("1970-01-01T00:00:00.000Z");
    expect(expirationToIso(1_700_000_000_000)).toBe(
      new Date(1_700_000_000_000).toISOString()
    );
  });
});

describe("toPublicPushSubscription", () => {
  test("strips the cryptographic key fields", () => {
    const row: IPushSubscriptionRow = {
      id: "00000000-0000-0000-0000-000000000001",
      userId: "00000000-0000-0000-0000-000000000002",
      endpoint: "https://push.example/abc",
      p256dhKey: "secret-p256dh-key",
      authKey: "secret-auth-key",
      userAgent: "Chrome on macOS",
      expiresAt: null,
      createdAt: "2026-05-19T00:00:00.000Z",
      lastUsedAt: "2026-05-19T00:00:00.000Z",
    };

    const result = toPublicPushSubscription(row);

    expect(result).toEqual({
      id: row.id,
      endpoint: row.endpoint,
      userAgent: row.userAgent,
      createdAt: row.createdAt,
      lastUsedAt: row.lastUsedAt,
    });
    expect(result).not.toHaveProperty("p256dhKey");
    expect(result).not.toHaveProperty("authKey");
  });
});
