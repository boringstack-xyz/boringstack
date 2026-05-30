import { describe, expect, it } from "vitest";

import { isAuthenticatedMe } from "./Auth.queries.utils";

describe("isAuthenticatedMe", () => {
  it("returns false for null", () => {
    expect(isAuthenticatedMe(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isAuthenticatedMe(undefined)).toBe(false);
  });

  it("returns false for non-object primitives", () => {
    expect(isAuthenticatedMe("string")).toBe(false);
    expect(isAuthenticatedMe(42)).toBe(false);
    expect(isAuthenticatedMe(true)).toBe(false);
  });

  it("returns false when `user` key is absent (openapi-fetch empty-content branch)", () => {
    expect(isAuthenticatedMe({})).toBe(false);
    expect(isAuthenticatedMe({ account: { id: "a", name: "A" } })).toBe(false);
  });

  it("returns false for the anonymous shape `{ user: null }`", () => {
    expect(isAuthenticatedMe({ user: null })).toBe(false);
  });

  it("returns true when `user` is a non-null object (authenticated shape)", () => {
    expect(
      isAuthenticatedMe({
        user: {
          id: "u1",
          email: "x@y.com",
          firstName: "X",
          lastName: "Y",
          emailVerified: true,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z"
        },
        account: { id: "a1", name: "Acme" },
        role: "owner",
        memberships: [],
        features: { can_export: true, can_invite_team: true, max_seats: 5 },
        capabilities: {
          billing: false,
          notificationsSse: true,
          webPush: true
        },
        authProviders: ["local"],
        hasPasswordLogin: true
      })
    ).toBe(true);
  });
});
