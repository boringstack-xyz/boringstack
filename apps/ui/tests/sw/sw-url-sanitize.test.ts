/*
 * Service-worker URL-sanitization regression tests. Tests the TS module
 * (`src/lib/web-push/sw-url-sanitize.ts`); the inlined copy at
 * `public/sw.js` is required to stay in sync.
 */
import { describe, expect, test } from "vitest";

import {
  clientPathMatches,
  sanitizeTargetPath
} from "../../src/lib/web-push/sw-url-sanitize";

const ORIGIN = "https://example.test";

describe("sanitizeTargetPath", () => {
  test("returns '/' for missing input", () => {
    expect(sanitizeTargetPath(null, ORIGIN)).toBe("/");
    expect(sanitizeTargetPath(undefined, ORIGIN)).toBe("/");
    expect(sanitizeTargetPath("", ORIGIN)).toBe("/");
  });

  test("returns '/' for non-string input", () => {
    expect(sanitizeTargetPath(42, ORIGIN)).toBe("/");
    expect(sanitizeTargetPath({}, ORIGIN)).toBe("/");
  });

  test("returns the path for a same-origin absolute URL", () => {
    expect(sanitizeTargetPath("https://example.test/dashboard", ORIGIN)).toBe(
      "/dashboard"
    );
  });

  test("preserves search + hash for same-origin URLs", () => {
    expect(
      sanitizeTargetPath("https://example.test/dashboard?id=42#detail", ORIGIN)
    ).toBe("/dashboard?id=42#detail");
  });

  test("accepts a relative path and resolves against the given origin", () => {
    expect(sanitizeTargetPath("/inbox?unread=1", ORIGIN)).toBe(
      "/inbox?unread=1"
    );
  });

  test("rejects off-origin URLs", () => {
    expect(sanitizeTargetPath("https://attacker.test/steal", ORIGIN)).toBe("/");
    expect(sanitizeTargetPath("http://example.test/insecure", ORIGIN)).toBe(
      "/"
    );
  });

  test("rejects javascript: and data: schemes", () => {
    expect(
      sanitizeTargetPath("javascript:alert(document.cookie)", ORIGIN)
    ).toBe("/");
    expect(
      sanitizeTargetPath("data:text/html,<script>1</script>", ORIGIN)
    ).toBe("/");
  });
});

describe("clientPathMatches", () => {
  test("matches exact same-origin path+search+hash", () => {
    expect(
      clientPathMatches("https://example.test/inbox?u=1", "/inbox?u=1", ORIGIN)
    ).toBe(true);
  });

  test("rejects substring matches (the prior bug)", () => {
    expect(
      clientPathMatches("https://example.test/inbox/123", "/inbox", ORIGIN)
    ).toBe(false);
  });

  test("rejects off-origin clients", () => {
    expect(
      clientPathMatches("https://attacker.test/inbox", "/inbox", ORIGIN)
    ).toBe(false);
  });

  test("rejects malformed client URLs", () => {
    expect(clientPathMatches("not-a-url", "/anything", ORIGIN)).toBe(false);
  });
});
