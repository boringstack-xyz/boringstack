import { describe, expect, it } from "vitest";

import { NOTIFICATION_BELL_BADGE_CAP } from "./NotificationBell.constants";
import { formatBadgeCount } from "./NotificationBell.utils";

describe("formatBadgeCount", () => {
  it("formats counts at or below the cap as a literal number", () => {
    expect(formatBadgeCount(0)).toBe("0");
    expect(formatBadgeCount(1)).toBe("1");
    expect(formatBadgeCount(NOTIFICATION_BELL_BADGE_CAP)).toBe(
      String(NOTIFICATION_BELL_BADGE_CAP)
    );
  });

  it("suffixes a plus sign when the count exceeds the cap", () => {
    expect(formatBadgeCount(NOTIFICATION_BELL_BADGE_CAP + 1)).toBe(
      `${String(NOTIFICATION_BELL_BADGE_CAP)}+`
    );
    expect(formatBadgeCount(9999)).toBe(
      `${String(NOTIFICATION_BELL_BADGE_CAP)}+`
    );
  });
});
