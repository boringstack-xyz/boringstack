import { describe, expect, test } from "bun:test";

import {
  narrowNotificationStatus,
  parseNotificationsLimit,
  readRenderedString,
  readRenderedNullableString,
  toPublicNotification,
  toRenderedRecord,
} from "../../../src/api/notifications/notifications.utils";
import { NOTIFICATIONS_DEFAULT_LIMIT } from "../../../src/api/notifications/notifications.constants";

/**
 * Minimal row shape that satisfies `toPublicNotification`. The fields
 * mirror the `notification` table's `InferSelectModel`: recipientUserId
 * (not userId), payload (raw event input), rendered (display strings).
 */
interface INotificationTestRow {
  id: string;
  recipientUserId: string;
  eventType: string;
  payload: unknown;
  rendered: unknown;
  status: string;
  readAt: string | null;
  createdAt: string;
}

const makeRow = (
  overrides: Partial<INotificationTestRow> = {}
): INotificationTestRow => ({
  id: "00000000-0000-0000-0000-000000000001",
  recipientUserId: "00000000-0000-0000-0000-0000000000aa",
  eventType: "test.event",
  payload: {},
  rendered: { title: "Hello", body: "World" },
  status: "unread",
  readAt: null,
  createdAt: "2026-05-17T00:00:00.000Z",
  ...overrides,
});

describe("narrowNotificationStatus", () => {
  test.each(["unread", "read", "archived"])(
    "accepts valid status '%s' as-is",
    (status) => {
      expect(narrowNotificationStatus(status)).toBe(status);
    }
  );

  test("falls back to 'unread' for unknown statuses", () => {
    expect(narrowNotificationStatus("deleted")).toBe("unread");
    expect(narrowNotificationStatus("")).toBe("unread");
    expect(narrowNotificationStatus("UNREAD")).toBe("unread");
  });
});

describe("parseNotificationsLimit", () => {
  test("returns default when raw is undefined", () => {
    expect(parseNotificationsLimit(undefined)).toBe(
      NOTIFICATIONS_DEFAULT_LIMIT
    );
  });

  test("returns default when raw is empty string", () => {
    expect(parseNotificationsLimit("")).toBe(NOTIFICATIONS_DEFAULT_LIMIT);
  });

  test("parses a valid numeric string", () => {
    expect(parseNotificationsLimit("10")).toBe(10);
  });

  test("returns default for NaN input", () => {
    expect(parseNotificationsLimit("abc")).toBe(NOTIFICATIONS_DEFAULT_LIMIT);
  });

  test("returns default for zero", () => {
    expect(parseNotificationsLimit("0")).toBe(NOTIFICATIONS_DEFAULT_LIMIT);
  });

  test("returns default for negative numbers", () => {
    expect(parseNotificationsLimit("-1")).toBe(NOTIFICATIONS_DEFAULT_LIMIT);
  });
});

describe("readRenderedString", () => {
  test("returns the string value", () => {
    expect(readRenderedString({ title: "Hi" }, "title")).toBe("Hi");
  });

  test("returns empty string when the key is missing", () => {
    expect(readRenderedString({}, "title")).toBe("");
  });

  test("returns empty string for non-string values", () => {
    expect(readRenderedString({ title: 42 }, "title")).toBe("");
    expect(readRenderedString({ title: null }, "title")).toBe("");
    expect(readRenderedString({ title: true }, "title")).toBe("");
  });
});

describe("readRenderedNullableString", () => {
  test("returns the string value", () => {
    expect(
      readRenderedNullableString({ ctaUrl: "https://x.com" }, "ctaUrl")
    ).toBe("https://x.com");
  });

  test("returns null when the key is missing", () => {
    expect(readRenderedNullableString({}, "ctaUrl")).toBeNull();
  });

  test("returns null for non-string values", () => {
    expect(readRenderedNullableString({ ctaUrl: 42 }, "ctaUrl")).toBeNull();
    expect(readRenderedNullableString({ ctaUrl: null }, "ctaUrl")).toBeNull();
    expect(readRenderedNullableString({ ctaUrl: false }, "ctaUrl")).toBeNull();
  });
});

describe("toRenderedRecord", () => {
  test("returns a copy of the object for plain records", () => {
    const input = { a: "x", b: 1 };

    expect(toRenderedRecord(input)).toEqual(input);
    expect(toRenderedRecord(input)).not.toBe(input);
  });

  test("returns empty record for null", () => {
    expect(toRenderedRecord(null)).toEqual({});
  });

  test("returns empty record for arrays", () => {
    expect(toRenderedRecord(["nope"])).toEqual({});
  });

  test("returns empty record for scalars", () => {
    expect(toRenderedRecord(42)).toEqual({});
    expect(toRenderedRecord("nope")).toEqual({});
  });
});

describe("toPublicNotification", () => {
  test("maps all rendered fields from a full row", () => {
    const row = makeRow({
      rendered: {
        title: "Welcome",
        body: "Thanks for signing up",
        ctaUrl: "https://example.com/dashboard",
        ctaLabel: "Dashboard",
      },
      status: "unread",
    });
    const result = toPublicNotification(row);

    expect(result.id).toBe(row.id);
    expect(result.eventType).toBe("test.event");
    expect(result.title).toBe("Welcome");
    expect(result.body).toBe("Thanks for signing up");
    expect(result.ctaUrl).toBe("https://example.com/dashboard");
    expect(result.ctaLabel).toBe("Dashboard");
    expect(result.status).toBe("unread");
    expect(result.readAt).toBeNull();
    expect(result.createdAt).toBe(row.createdAt);
  });

  test("handles a row with missing rendered fields gracefully", () => {
    const row = makeRow({
      rendered: { title: "Only title" },
    });
    const result = toPublicNotification(row);

    expect(result.title).toBe("Only title");
    expect(result.body).toBe("");
    expect(result.ctaUrl).toBeNull();
    expect(result.ctaLabel).toBeNull();
  });

  test("handles a row with null rendered", () => {
    const row = makeRow({
      rendered: null,
    });
    const result = toPublicNotification(row);

    expect(result.title).toBe("");
    expect(result.body).toBe("");
  });

  test("coerces invalid status to 'unread'", () => {
    const row = makeRow({ status: "invalid-status" });
    const result = toPublicNotification(row);

    expect(result.status).toBe("unread");
  });

  test("preserves readAt when non-null", () => {
    const row = makeRow({ readAt: "2026-05-17T12:00:00.000Z" });
    const result = toPublicNotification(row);

    expect(result.readAt).toBe("2026-05-17T12:00:00.000Z");
  });
});
