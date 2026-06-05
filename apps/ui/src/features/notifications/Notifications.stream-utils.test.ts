import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildStreamUrl,
  parseStreamMessage
} from "./Notifications.stream-utils";

const envMock = vi.hoisted(() => ({ VITE_API_URL: "" }));

vi.mock("@/lib/env", () => ({ env: envMock }));

describe("buildStreamUrl", () => {
  beforeEach(() => {
    envMock.VITE_API_URL = "";
  });

  it("appends the SSE path to a bare host", () => {
    envMock.VITE_API_URL = "https://api.example.com";
    expect(buildStreamUrl()).toBe(
      "https://api.example.com/api/v1/notifications/stream"
    );
  });

  it("strips a trailing slash before appending the path", () => {
    envMock.VITE_API_URL = "https://api.example.com/";
    expect(buildStreamUrl()).toBe(
      "https://api.example.com/api/v1/notifications/stream"
    );
  });

  it("handles an empty base URL (same-origin deployment, relative path)", () => {
    envMock.VITE_API_URL = "";
    expect(buildStreamUrl()).toBe("/api/v1/notifications/stream");
  });

  it("preserves a host with a path prefix (single trailing slash)", () => {
    envMock.VITE_API_URL = "https://api.example.com/v2/";
    expect(buildStreamUrl()).toBe(
      "https://api.example.com/v2/api/v1/notifications/stream"
    );
  });
});

describe("parseStreamMessage", () => {
  /*
   * `parseStreamMessage` already has implicit coverage via the
   * `useNotificationStream` hook test, but pinning a couple of
   * cases here keeps the sibling test honest about both exports
   * the module ships.
   */
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("returns the parsed payload for a notification.created envelope", () => {
    const notification = {
      id: "n-1",
      title: "Hello",
      body: "world",
      status: "unread",
      createdAt: "2026-05-31T00:00:00Z",
      ctaUrl: null,
      ctaLabel: null
    };
    const message = parseStreamMessage(
      JSON.stringify({ type: "notification.created", notification })
    );

    expect(message?.type).toBe("notification.created");
    expect(message?.notification.id).toBe("n-1");
  });

  it("returns undefined for an unknown envelope type", () => {
    const message = parseStreamMessage(
      JSON.stringify({ type: "noise", notification: {} })
    );

    expect(message).toBeUndefined();
  });

  it("returns undefined when the notification has no string id", () => {
    const message = parseStreamMessage(
      JSON.stringify({
        type: "notification.created",
        notification: { title: "no id here" }
      })
    );

    expect(message).toBeUndefined();
  });

  it("returns undefined on malformed JSON", () => {
    expect(parseStreamMessage("{not json")).toBeUndefined();
  });
});
