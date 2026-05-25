import { AbilityBuilder, createMongoAbility } from "@casl/ability";

import { ApiErrors } from "../errors";

import { ROLE } from "./acl.constants";

import type { Action, AppAbility, AppSubject, IMembership } from "./acl.types";
import type { ResolvedFeatures } from "./feature-resolution.types";

export function buildAbility(
  membership: IMembership,
  features: ResolvedFeatures
): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(
    createMongoAbility
  );
  const { accountId } = membership;

  switch (membership.role) {
    case ROLE.owner:
      can("manage", "Widget", { accountId });
      can("manage", "TeamMember", { accountId });
      can("manage", "Site", { accountId });
      can("manage", "Account", { id: accountId });
      break;
    case ROLE.admin:
      /*
       * Admin manages content + members + settings, but NOT the account
       * itself: deleting the account, transferring ownership, and
       * changing account-level billing stay with the owner. Billing
       * routes also enforce owner-only at the route layer.
       */
      can("manage", "Widget", { accountId });
      can("manage", "TeamMember", { accountId });
      can("manage", "Site", { accountId });
      can("read", "Account", { id: accountId });
      break;
    case ROLE.member:
      can("read", "Widget", { accountId });
      can("read", "TeamMember", { accountId });
      can("read", "Site", { accountId });
      can("read", "Account", { id: accountId });
      can("create", "Widget", { accountId });
      can("update", "Widget", { accountId });
      can("delete", "Widget", { accountId });
      break;
    case ROLE.viewer:
      can("read", "Widget", { accountId });
      can("read", "TeamMember", { accountId });
      can("read", "Site", { accountId });
      can("read", "Account", { id: accountId });
      break;
  }

  /*
   * Feature gates: a missing feature forbids the action regardless of
   * role. Per-account `admin` does NOT bypass plan checks; only
   * `users.is_platform_admin = true` bypasses, and that bypass is
   * applied above this layer with an audit row.
   */
  if (!features.can_export) {
    cannot("export", "Widget");
  }

  if (!features.can_invite_team) {
    cannot("invite", "TeamMember");
  }

  return build();
}

const describeSubject = (resource: AppSubject): string => {
  if (typeof resource === "string") {
    return resource;
  }

  return resource.__caslSubjectType__;
};

export function requireAbility(
  ability: AppAbility,
  action: Action,
  resource: AppSubject
): void {
  if (ability.cannot(action, resource)) {
    throw ApiErrors.forbidden(
      `Forbidden: action="${action}" subject="${describeSubject(resource)}"`
    );
  }
}
