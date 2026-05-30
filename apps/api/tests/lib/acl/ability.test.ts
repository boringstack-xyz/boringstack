import { subject } from "@casl/ability";
import { describe, expect, test } from "bun:test";

import { buildAbility, requireAbility } from "../../../src/lib/acl/ability";
import type { IMembership, Role } from "../../../src/lib/acl/acl.types";
import type { ResolvedFeatures } from "../../../src/lib/acl/feature-resolution.types";

const ACCOUNT_A = "acc-aaaaaaaa";
const ACCOUNT_B = "acc-bbbbbbbb";

const memberOf = (role: Role, accountId: string = ACCOUNT_A): IMembership => ({
  userId: "u1",
  accountId,
  role,
});

const fullFeatures: ResolvedFeatures = {
  can_export: true,
  can_invite_team: true,
  max_seats: 50,
};

const noFeatures: ResolvedFeatures = {
  can_export: false,
  can_invite_team: false,
  max_seats: 1,
};

const siteIn = (accountId: string) => subject("Site", { accountId });

const teamMemberIn = (accountId: string) =>
  subject("TeamMember", { accountId });

const accountWithId = (id: string) => subject("Account", { id });

describe("buildAbility — role rules", () => {
  test("owner can read, update, and delete sites in their account", () => {
    const ability = buildAbility(memberOf("owner"), fullFeatures);

    expect(ability.can("read", siteIn(ACCOUNT_A))).toBe(true);
    expect(ability.can("update", siteIn(ACCOUNT_A))).toBe(true);
    expect(ability.can("delete", siteIn(ACCOUNT_A))).toBe(true);
  });

  test("owner cannot touch resources in a different account (cross-account isolation)", () => {
    const ability = buildAbility(memberOf("owner", ACCOUNT_A), fullFeatures);

    expect(ability.can("read", siteIn(ACCOUNT_B))).toBe(false);
    expect(ability.can("update", siteIn(ACCOUNT_B))).toBe(false);
  });

  test("admin cannot delete or update the account itself (owner-only)", () => {
    const ability = buildAbility(memberOf("admin"), fullFeatures);

    expect(ability.can("delete", accountWithId(ACCOUNT_A))).toBe(false);
    expect(ability.can("update", accountWithId(ACCOUNT_A))).toBe(false);
  });

  test("admin can still manage members + sites in their account", () => {
    const ability = buildAbility(memberOf("admin"), fullFeatures);

    expect(ability.can("update", siteIn(ACCOUNT_A))).toBe(true);
    expect(ability.can("delete", siteIn(ACCOUNT_A))).toBe(true);
    expect(ability.can("invite", teamMemberIn(ACCOUNT_A))).toBe(true);
  });

  test("member can read + write sites but cannot invite", () => {
    const ability = buildAbility(memberOf("member"), fullFeatures);

    expect(ability.can("create", siteIn(ACCOUNT_A))).toBe(true);
    expect(ability.can("update", siteIn(ACCOUNT_A))).toBe(true);
    expect(ability.can("delete", siteIn(ACCOUNT_A))).toBe(true);
    expect(ability.can("invite", teamMemberIn(ACCOUNT_A))).toBe(false);
  });

  test("viewer can only read", () => {
    const ability = buildAbility(memberOf("viewer"), fullFeatures);

    expect(ability.can("read", siteIn(ACCOUNT_A))).toBe(true);
    expect(ability.can("create", siteIn(ACCOUNT_A))).toBe(false);
    expect(ability.can("update", siteIn(ACCOUNT_A))).toBe(false);
    expect(ability.can("delete", siteIn(ACCOUNT_A))).toBe(false);
  });
});

describe("buildAbility — feature gates", () => {
  test("can_export=false forbids export even for owner (admins do NOT bypass plan checks)", () => {
    const ability = buildAbility(memberOf("owner"), noFeatures);

    expect(ability.can("export", siteIn(ACCOUNT_A))).toBe(false);
  });

  test("can_export=true unlocks export within the owner's account", () => {
    const ability = buildAbility(memberOf("owner"), fullFeatures);

    expect(ability.can("export", siteIn(ACCOUNT_A))).toBe(true);
  });

  test("can_export=true does NOT unlock export across accounts", () => {
    const ability = buildAbility(memberOf("owner", ACCOUNT_A), fullFeatures);

    expect(ability.can("export", siteIn(ACCOUNT_B))).toBe(false);
  });

  test("can_invite_team=false forbids invite even for admin", () => {
    const ability = buildAbility(memberOf("admin"), noFeatures);

    expect(ability.can("invite", teamMemberIn(ACCOUNT_A))).toBe(false);
  });

  test("can_invite_team=true unlocks invite for admin within their account", () => {
    const ability = buildAbility(memberOf("admin"), fullFeatures);

    expect(ability.can("invite", teamMemberIn(ACCOUNT_A))).toBe(true);
  });
});

describe("requireAbility", () => {
  test("does not throw when the action is allowed", () => {
    const ability = buildAbility(memberOf("owner"), fullFeatures);

    expect(() => {
      requireAbility(ability, "read", siteIn(ACCOUNT_A));
    }).not.toThrow();
  });

  test("throws a forbidden ApiError when the action is denied", () => {
    const ability = buildAbility(memberOf("viewer"), fullFeatures);

    expect(() => {
      requireAbility(ability, "update", siteIn(ACCOUNT_A));
    }).toThrow(/forbidden/iu);
  });

  test("error message names the action and the subject for ops debugging", () => {
    const ability = buildAbility(memberOf("viewer"), fullFeatures);

    expect(() => {
      requireAbility(ability, "delete", siteIn(ACCOUNT_A));
    }).toThrow(/delete/u);
  });
});
