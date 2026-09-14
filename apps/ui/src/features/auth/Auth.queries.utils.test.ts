import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/ApiError";
import type { IMe } from "@/lib/session";

import { resolveAuthStatus } from "./Auth.queries.utils";

const ME_FIXTURE: IMe = {
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
  memberships: [{ accountId: "a1", accountName: "Acme", role: "owner" }],
  features: { can_export: true, can_invite_team: true, max_seats: 5 },
  capabilities: { billing: false, notificationsSse: true, webPush: true },
  authProviders: ["local"],
  hasPasswordLogin: true
};

describe("resolveAuthStatus", () => {
  it("returns 'authed' for an IMe payload", () => {
    const status = resolveAuthStatus({ data: ME_FIXTURE, error: null });

    expect(status).toEqual({ kind: "authed", me: ME_FIXTURE });
  });

  it("returns 'anonymous' for an explicit null data", () => {
    const status = resolveAuthStatus({ data: null, error: null });

    expect(status).toEqual({ kind: "anonymous" });
  });

  it("returns null while data is still resolving (undefined + no error)", () => {
    const status = resolveAuthStatus({ data: undefined, error: null });

    expect(status).toBeNull();
  });

  it("returns 'unauthorized' for ApiError 401", () => {
    const error = new ApiError(401, { message: "Unauthorized" });
    const status = resolveAuthStatus({ data: undefined, error });

    expect(status).toEqual({ kind: "unauthorized", error });
  });

  it("returns 'unauthorized' for ApiError 403", () => {
    const error = new ApiError(403, { message: "Forbidden" });
    const status = resolveAuthStatus({ data: undefined, error });

    expect(status?.kind).toBe("unauthorized");
  });

  it("returns 'offline' for a network error", () => {
    const error = new Error("network is down");
    const status = resolveAuthStatus({ data: undefined, error });

    expect(status?.kind).toBe("offline");
    expect((status as { kind: "offline"; error: unknown }).error).toBe(error);
  });

  it("returns 'offline' for a 5xx ApiError (not a forced-logout)", () => {
    const error = new ApiError(500, { message: "Server error" });
    const status = resolveAuthStatus({ data: undefined, error });

    expect(status?.kind).toBe("offline");
  });
});
