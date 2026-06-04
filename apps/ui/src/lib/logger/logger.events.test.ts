import { describe, expect, it } from "vitest";

import { LOG_EVENTS } from "./logger.events";

describe("LOG_EVENTS", () => {
  it("is a non-empty list of event names", () => {
    expect(LOG_EVENTS.length).toBeGreaterThan(0);

    for (const event of LOG_EVENTS) {
      expect(typeof event).toBe("string");
      expect(event.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate event names", () => {
    expect(new Set(LOG_EVENTS).size).toBe(LOG_EVENTS.length);
  });

  /*
   * The file documents that the list is sorted "to make conflicts during PR
   * rebase trivial" — lock that invariant in so it cannot silently drift.
   */
  it("stays sorted", () => {
    const sorted = [...LOG_EVENTS].sort();

    expect([...LOG_EVENTS]).toEqual(sorted);
  });

  /*
   * Every event is namespaced as dotted lowercase segments, e.g.
   * "auth.login_success" or "notifications.web_push.subscribe_failed".
   */
  it("namespaces every event as dotted lowercase segments", () => {
    for (const event of LOG_EVENTS) {
      expect(event).toMatch(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/u);
    }
  });
});
