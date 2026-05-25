import { AbilityBuilder, createMongoAbility } from "@casl/ability";

import type { IResolvedFeatures } from "@/features/auth/Auth.types";

import { ROLE } from "./acl.types";
import type { AppAbility, Role } from "./acl.types";

/**
 * Pure function: maps `(role, accountId, features)` to a CASL ability for
 * UI rendering. Mirrors `api-template/src/lib/acl/ability.ts` exactly.
 *
 * Critically: the UI-side ability is a **rendering hint only**. The server
 * never trusts client-derived rules. Every mutating route on the API runs
 * its own `requireAbility(...)` from server-side state.
 */
export function buildAbility(
  role: Role,
  accountId: string,
  features: IResolvedFeatures
): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(
    createMongoAbility
  );

  switch (role) {
    case ROLE.owner:
      can("manage", "Widget", { accountId });
      can("manage", "TeamMember", { accountId });
      can("manage", "Site", { accountId });
      can("manage", "Account", { id: accountId });
      break;
    case ROLE.admin:
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
    default:
      break;
  }

  if (!features.can_export) {
    cannot("export", "Widget");
  }

  if (!features.can_invite_team) {
    cannot("invite", "TeamMember");
  }

  return build();
}
