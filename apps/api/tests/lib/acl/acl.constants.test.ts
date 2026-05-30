import { describe, expect, test } from "bun:test";

import {
  ACTIONS,
  FEATURE_KEYS,
  FEATURES,
  ROLE,
  ROLES,
  SUBJECTS,
} from "../../../src/lib/acl/acl.constants";

describe("ACL const tuples", () => {
  test("ROLE exposes canonical role literals", () => {
    expect(ROLE).toEqual({
      owner: "owner",
      admin: "admin",
      member: "member",
      viewer: "viewer",
    });
  });

  test("ROLES contains the four canonical roles in declared order", () => {
    expect([...ROLES]).toEqual([
      ROLE.owner,
      ROLE.admin,
      ROLE.member,
      ROLE.viewer,
    ]);
  });

  test("ACTIONS covers CRUD + manage + export + invite", () => {
    expect([...ACTIONS]).toEqual([
      "read",
      "create",
      "update",
      "delete",
      "manage",
      "export",
      "invite",
    ]);
  });

  test("SUBJECTS includes 'all' so wildcard rules are expressible", () => {
    expect([...SUBJECTS]).toContain("all");
    expect([...SUBJECTS]).toContain("Account");
  });

  test("FEATURE_KEYS has boolean and numeric features from day one", () => {
    expect([...FEATURE_KEYS]).toContain("can_export");
    expect([...FEATURE_KEYS]).toContain("max_seats");
  });
});

describe("FEATURES catalog", () => {
  test("has an entry for every FEATURE_KEY", () => {
    for (const key of FEATURE_KEYS) {
      expect(FEATURES[key]).toBeDefined();
    }
  });

  test("every entry declares either kind: 'boolean' or kind: 'limit'", () => {
    for (const key of FEATURE_KEYS) {
      const entry = FEATURES[key];

      expect(["boolean", "limit"]).toContain(entry.kind);
    }
  });

  test("boolean features default to a boolean; limit features default to a number", () => {
    for (const key of FEATURE_KEYS) {
      const entry = FEATURES[key];

      if (entry.kind === "boolean") {
        expect(typeof entry.default).toBe("boolean");
      } else {
        expect(typeof entry.default).toBe("number");
        expect(entry.default).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test("limit defaults match the Free-plan baseline (max_seats=1)", () => {
    expect(FEATURES.max_seats).toEqual({ kind: "limit", default: 1 });
  });

  test("boolean defaults are false (paid features are off by default)", () => {
    expect(FEATURES.can_export).toEqual({ kind: "boolean", default: false });
    expect(FEATURES.can_invite_team).toEqual({
      kind: "boolean",
      default: false,
    });
  });
});
