import { describe, expect, it } from "vitest";

import { inviteMemberSchema } from "./Accounts.schemas";

describe("inviteMemberSchema", () => {
  it("accepts a well-formed invite payload", () => {
    const result = inviteMemberSchema.safeParse({
      email: "new@example.com",
      roleToAssign: "member"
    });

    expect(result.success).toBe(true);
  });

  it("accepts each of the three valid roles", () => {
    for (const role of ["admin", "member", "viewer"] as const) {
      const result = inviteMemberSchema.safeParse({
        email: "x@example.com",
        roleToAssign: role
      });

      expect(result.success).toBe(true);
    }
  });

  it("rejects an unknown role", () => {
    const result = inviteMemberSchema.safeParse({
      email: "x@example.com",
      roleToAssign: "owner"
    });

    expect(result.success).toBe(false);
  });

  it("rejects a malformed email", () => {
    const result = inviteMemberSchema.safeParse({
      email: "not-an-email",
      roleToAssign: "member"
    });

    expect(result.success).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(inviteMemberSchema.safeParse({}).success).toBe(false);
    expect(
      inviteMemberSchema.safeParse({ email: "x@example.com" }).success
    ).toBe(false);
    expect(
      inviteMemberSchema.safeParse({ roleToAssign: "member" }).success
    ).toBe(false);
  });
});
