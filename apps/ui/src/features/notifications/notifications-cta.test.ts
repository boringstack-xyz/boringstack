import { describe, expect, it } from "vitest";

import { sanitizeTargetPath } from "@/lib/web-push/sw-url-sanitize";

/*
 * Both in-app render paths (`useNotificationStream.ts` toast +
 * `NotificationListItem.tsx` link) feed `notification.ctaUrl`
 * through `sanitizeTargetPath` with `window.location.origin` as the
 * second arg. This test pins the shared semantics so a future
 * regression in either consumer is caught by the same test rather
 * than a per-component test that only covers one path.
 */
const ORIGIN = "https://app.example.test";

describe("in-app notification CTA sanitization", () => {
  it("preserves a same-origin path", () => {
    expect(sanitizeTargetPath("/notifications/123", ORIGIN)).toBe(
      "/notifications/123"
    );
  });

  it("preserves a same-origin absolute URL", () => {
    expect(sanitizeTargetPath(`${ORIGIN}/dashboard?tab=alerts`, ORIGIN)).toBe(
      "/dashboard?tab=alerts"
    );
  });

  it("collapses an off-origin URL to /", () => {
    expect(sanitizeTargetPath("https://evil.example.com/bait", ORIGIN)).toBe(
      "/"
    );
  });

  it("collapses a protocol-relative URL to /", () => {
    expect(sanitizeTargetPath("//evil.example.com/bait", ORIGIN)).toBe("/");
  });

  it("collapses a javascript: URL to /", () => {
    expect(sanitizeTargetPath("javascript:alert(1)", ORIGIN)).toBe("/");
  });

  it("collapses empty input to /", () => {
    expect(sanitizeTargetPath("", ORIGIN)).toBe("/");
  });

  it("resolves a bare token as a same-origin path (the URL parser percent-encodes the space)", () => {
    /*
     * `new URL("not a url", ORIGIN)` resolves to `${ORIGIN}/not%20a%20url`,
     * which is same-origin and therefore passes the allowlist. The point
     * of `sanitizeTargetPath` is not URL syntax validation — it's a
     * cross-origin gate, and that's covered above.
     */
    expect(sanitizeTargetPath("not a url", ORIGIN)).toBe("/not%20a%20url");
  });
});
