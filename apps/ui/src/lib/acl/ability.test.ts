import { subject } from "@casl/ability";
import { describe, expect, it } from "vitest";

import type { IResolvedFeatures } from "@/features/auth/Auth.types";

import { buildAbility } from "./ability";

const ACCOUNT_ID = "acc-1";
const OTHER_ACCOUNT_ID = "acc-2";

const featuresAllOn: IResolvedFeatures = {
  can_export: true,
  can_invite_team: true,
  max_seats: 10,
  max_widgets: 100
};

const featuresAllOff: IResolvedFeatures = {
  can_export: false,
  can_invite_team: false,
  max_seats: 1,
  max_widgets: 5
};

const widgetIn = (accountId: string) =>
  subject("Widget", { id: "w1", accountId });

const teamMemberIn = (accountId: string) =>
  subject("TeamMember", { id: "tm1", accountId });

describe("buildAbility — owner", () => {
  it("can manage own-account widgets and team members", () => {
    const ability = buildAbility("owner", ACCOUNT_ID, featuresAllOn);

    expect(ability.can("read", widgetIn(ACCOUNT_ID))).toBe(true);
    expect(ability.can("update", widgetIn(ACCOUNT_ID))).toBe(true);
    expect(ability.can("delete", widgetIn(ACCOUNT_ID))).toBe(true);
    expect(ability.can("invite", teamMemberIn(ACCOUNT_ID))).toBe(true);
  });

  it("cannot touch widgets that belong to another account", () => {
    const ability = buildAbility("owner", ACCOUNT_ID, featuresAllOn);

    expect(ability.can("read", widgetIn(OTHER_ACCOUNT_ID))).toBe(false);
    expect(ability.can("update", widgetIn(OTHER_ACCOUNT_ID))).toBe(false);
  });
});

describe("buildAbility — viewer", () => {
  it("can read but cannot mutate widgets", () => {
    const ability = buildAbility("viewer", ACCOUNT_ID, featuresAllOn);

    expect(ability.can("read", widgetIn(ACCOUNT_ID))).toBe(true);
    expect(ability.can("update", widgetIn(ACCOUNT_ID))).toBe(false);
    expect(ability.can("delete", widgetIn(ACCOUNT_ID))).toBe(false);
  });

  it("cannot invite team members", () => {
    const ability = buildAbility("viewer", ACCOUNT_ID, featuresAllOn);

    expect(ability.can("invite", teamMemberIn(ACCOUNT_ID))).toBe(false);
  });
});

describe("buildAbility — feature gates", () => {
  it("disables export when can_export is false, even for owners", () => {
    const owner = buildAbility("owner", ACCOUNT_ID, featuresAllOff);

    expect(owner.can("export", widgetIn(ACCOUNT_ID))).toBe(false);
  });

  it("enables export when can_export is true", () => {
    const owner = buildAbility("owner", ACCOUNT_ID, featuresAllOn);

    expect(owner.can("export", widgetIn(ACCOUNT_ID))).toBe(true);
  });

  it("disables invite when can_invite_team is false, even for owners", () => {
    const owner = buildAbility("owner", ACCOUNT_ID, featuresAllOff);

    expect(owner.can("invite", teamMemberIn(ACCOUNT_ID))).toBe(false);
  });
});

describe("buildAbility — admin vs owner on the account itself", () => {
  it("owner can manage the account, admin can only read it", () => {
    const owner = buildAbility("owner", ACCOUNT_ID, featuresAllOn);
    const admin = buildAbility("admin", ACCOUNT_ID, featuresAllOn);

    const acc = subject("Account", { id: ACCOUNT_ID });

    expect(owner.can("delete", acc)).toBe(true);
    expect(admin.can("delete", acc)).toBe(false);
    expect(admin.can("read", acc)).toBe(true);
  });
});
