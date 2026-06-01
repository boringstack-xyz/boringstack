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

export const SUBJECTS = ["TeamMember", "Site", "Account", "all"] as const;

export const FEATURE_KEYS = [
  "can_export",
  "can_invite_team",
  "max_seats",
] as const;

export const FEATURES = {
  can_export: { kind: "boolean", default: false },
  can_invite_team: { kind: "boolean", default: false },
  max_seats: { kind: "limit", default: 1 },
} as const;
