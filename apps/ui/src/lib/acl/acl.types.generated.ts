/*
 * AUTO-GENERATED — do not edit. Run `pnpm generate:acl-types` in the
 * apps/api repo to refresh this file. Drift between this file and
 * apps/api/src/lib/acl/acl.constants.ts fails CI via
 * `pnpm generate:acl-types:check`.
 */

export const ROLE = {
  owner: "owner",
  admin: "admin",
  member: "member",
  viewer: "viewer",
} as const;

export const ROLES = [
  ROLE.owner,
  ROLE.admin,
  ROLE.member,
  ROLE.viewer,
] as const;

export const ACTIONS = [
  "read",
  "create",
  "update",
  "delete",
  "manage",
  "export",
  "invite",
] as const;

export const SUBJECTS = [
  "Widget",
  "TeamMember",
  "Site",
  "Account",
  "all",
] as const;

export const FEATURE_KEYS = [
  "can_export",
  "can_invite_team",
  "max_seats",
  "max_widgets",
] as const;

export const FEATURES = {
  can_export: { kind: "boolean", default: false },
  can_invite_team: { kind: "boolean", default: false },
  max_seats: { kind: "limit", default: 1 },
  max_widgets: { kind: "limit", default: 5 },
} as const;
