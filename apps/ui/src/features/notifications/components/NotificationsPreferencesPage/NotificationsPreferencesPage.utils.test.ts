import { describe, expect, it } from "vitest";

import type { INotificationPreference } from "../../Notifications.types";
import {
  channelHeaderKey,
  groupByEventType,
  rowsToPreferences,
  toggleChannel
} from "./NotificationsPreferencesPage.utils";

describe("channelHeaderKey", () => {
  it("maps in-app to the inApp i18n key", () => {
    expect(channelHeaderKey("in-app")).toBe(
      "notifications.preferences.columns.inApp"
    );
  });

  it("maps web-push to the webPush i18n key", () => {
    expect(channelHeaderKey("web-push")).toBe(
      "notifications.preferences.columns.webPush"
    );
  });

  it("falls through to email for any other channel name", () => {
    expect(channelHeaderKey("email")).toBe(
      "notifications.preferences.columns.email"
    );
    expect(channelHeaderKey("sms")).toBe(
      "notifications.preferences.columns.email"
    );
  });
});

describe("groupByEventType", () => {
  it("groups distinct (eventType, channel, enabled) tuples into per-event rows", () => {
    const prefs: INotificationPreference[] = [
      { eventType: "auth.login", channel: "in-app", enabled: true },
      { eventType: "auth.login", channel: "email", enabled: false },
      { eventType: "billing.invoice", channel: "in-app", enabled: true }
    ];
    const rows = groupByEventType(prefs);

    expect(rows).toHaveLength(2);

    const login = rows.find((r) => r.eventType === "auth.login");

    expect(login?.channels["in-app"]).toBe(true);
    expect(login?.channels.email).toBe(false);
  });

  it("returns rows sorted alphabetically by eventType", () => {
    const prefs: INotificationPreference[] = [
      { eventType: "z.event", channel: "in-app", enabled: true },
      { eventType: "a.event", channel: "in-app", enabled: true },
      { eventType: "m.event", channel: "in-app", enabled: true }
    ];
    const rows = groupByEventType(prefs);

    expect(rows.map((r) => r.eventType)).toEqual([
      "a.event",
      "m.event",
      "z.event"
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(groupByEventType([])).toEqual([]);
  });
});

describe("rowsToPreferences", () => {
  it("is the inverse of groupByEventType up to ordering", () => {
    const prefs: INotificationPreference[] = [
      { eventType: "auth.login", channel: "in-app", enabled: true },
      { eventType: "auth.login", channel: "email", enabled: false }
    ];
    const out = rowsToPreferences(groupByEventType(prefs));

    expect(out).toHaveLength(2);
    expect(out.find((p) => p.channel === "in-app")?.enabled).toBe(true);
    expect(out.find((p) => p.channel === "email")?.enabled).toBe(false);
  });
});

describe("toggleChannel", () => {
  it("flips the supplied (eventType, channel) value and leaves the rest untouched", () => {
    const rows = [
      {
        eventType: "auth.login",
        channels: { "in-app": true, email: false }
      },
      {
        eventType: "billing.invoice",
        channels: { "in-app": true, email: true }
      }
    ];
    const next = toggleChannel(rows, "auth.login", "email");
    const login = next.find((r) => r.eventType === "auth.login");
    const billing = next.find((r) => r.eventType === "billing.invoice");

    expect(login?.channels.email).toBe(true);
    expect(login?.channels["in-app"]).toBe(true);
    expect(billing).toEqual(rows[1]);
  });

  it("is a no-op when the eventType is not present", () => {
    const rows = [
      {
        eventType: "auth.login",
        channels: { "in-app": true }
      }
    ];

    expect(toggleChannel(rows, "missing", "in-app")).toEqual(rows);
  });
});
