import { describe, expect, test } from "bun:test";

import { ROLE } from "../../../src/lib/acl/acl.constants";
import { toActiveMembership } from "../../../src/api/accounts/accounts.utils";

const TIMESTAMP = "2026-01-01T00:00:00.000Z";

describe("toActiveMembership", () => {
  test("coerces the persisted role string to Role", () => {
    const membership = toActiveMembership({
      id: "m1",
      accountId: "acc1",
      userId: "u1",
      role: "admin",
      invitedByUserId: null,
      joinedAt: TIMESTAMP,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
      revokedAt: null,
      revokedReason: null,
    });

    expect(membership.role).toBe(ROLE.admin);
  });

  test("throws when the persisted role is unknown", () => {
    expect(() =>
      toActiveMembership({
        id: "m1",
        accountId: "acc1",
        userId: "u1",
        role: "superadmin",
        invitedByUserId: null,
        joinedAt: TIMESTAMP,
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
        revokedAt: null,
        revokedReason: null,
      })
    ).toThrow(/Unknown membership role/);
  });
});
