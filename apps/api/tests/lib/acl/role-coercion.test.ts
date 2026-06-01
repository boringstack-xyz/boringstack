import { describe, expect, test } from "bun:test";

import { ROLE } from "../../../src/lib/acl/acl.constants";
import { isAdminRole, isOwnerRole } from "../../../src/lib/acl/role-coercion";

describe("role predicates", () => {
  test("isOwnerRole matches only owner", () => {
    expect(isOwnerRole(ROLE.owner)).toBe(true);
    expect(isOwnerRole(ROLE.admin)).toBe(false);
    expect(isOwnerRole(ROLE.member)).toBe(false);
    expect(isOwnerRole(ROLE.viewer)).toBe(false);
  });

  test("isAdminRole matches only admin", () => {
    expect(isAdminRole(ROLE.admin)).toBe(true);
    expect(isAdminRole(ROLE.owner)).toBe(false);
    expect(isAdminRole(ROLE.member)).toBe(false);
    expect(isAdminRole(ROLE.viewer)).toBe(false);
  });
});
