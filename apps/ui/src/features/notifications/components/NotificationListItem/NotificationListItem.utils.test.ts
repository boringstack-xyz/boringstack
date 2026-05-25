import { describe, expect, it } from "vitest";

import { NOTIFICATION_LIST_ITEM_BODY_PREVIEW_LENGTH } from "./NotificationListItem.constants";
import { previewBody } from "./NotificationListItem.utils";

describe("previewBody", () => {
  it("returns the body unchanged when at or below the cap", () => {
    const short = "Welcome aboard!";

    expect(previewBody(short)).toBe(short);
  });

  it("truncates and appends an ellipsis when exceeding the cap", () => {
    const over = "x".repeat(NOTIFICATION_LIST_ITEM_BODY_PREVIEW_LENGTH + 10);
    const result = previewBody(over);

    expect(result.endsWith("…")).toBe(true);
    expect(result.length).toBe(NOTIFICATION_LIST_ITEM_BODY_PREVIEW_LENGTH + 1);
  });

  it("trims trailing whitespace before the ellipsis", () => {
    const body = `${"a".repeat(
      NOTIFICATION_LIST_ITEM_BODY_PREVIEW_LENGTH - 1
    )}   tail`;
    const result = previewBody(body);

    expect(result.endsWith("…")).toBe(true);
    expect(result).not.toContain(" …");
  });
});
