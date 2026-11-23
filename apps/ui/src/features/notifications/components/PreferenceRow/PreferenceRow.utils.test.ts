import { describe, expect, it } from "vitest";

import { eventLabelKey } from "./PreferenceRow.utils";

describe("eventLabelKey", () => {
  it("names every event the API sends", () => {
    for (const eventType of [
      "auth.welcome",
      "auth.password_reset_completed",
      "account.invitation_accepted",
      "account.ownership_transferred",
      "lifecycle.welcome-follow-up"
    ]) {
      expect(eventLabelKey(eventType)).toMatch(
        /^notifications\.preferences\.events\./u
      );
    }
  });

  it("returns null for an unknown event", () => {
    expect(eventLabelKey("comment.replied")).toBeNull();
  });
});
