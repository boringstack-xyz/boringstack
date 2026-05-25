import { describe, expect, test } from "bun:test";

import { computeInvitationExpiresAt } from "../../../src/api/accounts/invitations.utils";

describe("computeInvitationExpiresAt", () => {
  test("returns an ISO timestamp in the future (default 14-day TTL)", () => {
    const before = Date.now() + 13 * 86_400_000;
    const result = computeInvitationExpiresAt();
    const after = Date.now() + 15 * 86_400_000;

    expect(result).toBeString();
    expect(Date.parse(result)).toBeGreaterThan(before);
    expect(Date.parse(result)).toBeLessThan(after);
  });

  test("returns a valid ISO string parseable by new Date()", () => {
    const result = computeInvitationExpiresAt();
    const reparsed = new Date(result);

    expect(reparsed.getTime()).toBeGreaterThan(Date.now());
    expect(Number.isNaN(reparsed.getTime())).toBe(false);
  });

  test("returns a timestamp strictly in the future", () => {
    const before = Date.now();
    const result = computeInvitationExpiresAt();

    expect(Date.parse(result)).toBeGreaterThan(before);
  });

  test("returns a UTC string ending in Z", () => {
    expect(computeInvitationExpiresAt()).toMatch(/Z$/);
  });
});
