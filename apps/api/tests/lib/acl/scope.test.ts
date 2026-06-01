import { describe, expect, test } from "bun:test";

import { scopedTo } from "../../../src/lib/acl/scope";

describe("scopedTo", () => {
  test("returns an account-scope object exposing accountId for filter use", () => {
    const scope = scopedTo({
      userId: "u1",
      accountId: "acc-1",
      role: "owner",
    });

    expect(scope.accountId).toBe("acc-1");
  });

  test("does not mutate the input membership", () => {
    const membership = {
      userId: "u1",
      accountId: "acc-1",
      role: "viewer" as const,
    };

    scopedTo(membership);

    expect(membership.accountId).toBe("acc-1");
  });

  test.each(["owner", "admin", "member", "viewer"] as const)(
    "returns an account-scope for role %s",
    (role) => {
      const scope = scopedTo({ userId: "u1", accountId: "acc-1", role });

      expect(scope.accountId).toBe("acc-1");
    }
  );

  test("the returned scope does not leak the membership role or userId", () => {
    const scope = scopedTo({
      userId: "u1",
      accountId: "acc-1",
      role: "owner",
    });

    expect("role" in scope).toBe(false);
    expect("userId" in scope).toBe(false);
  });
});
