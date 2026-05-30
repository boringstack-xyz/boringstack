import { t } from "elysia";

import { ROLE } from "../../lib/acl";

export const UserProfileResponse = t.Object({
  id: t.String(),
  email: t.String(),
  firstName: t.String(),
  lastName: t.String(),
  emailVerified: t.Boolean(),
  createdAt: t.String(),
  updatedAt: t.String(),
});

export const UpdateUserProfileSchema = t.Object({
  firstName: t.Optional(t.String({ maxLength: 100 })),
  lastName: t.Optional(t.String({ maxLength: 100 })),
});

const RoleSchema = t.Union([
  t.Literal(ROLE.owner),
  t.Literal(ROLE.admin),
  t.Literal(ROLE.member),
  t.Literal(ROLE.viewer),
]);

const MembershipSummarySchema = t.Object({
  accountId: t.String(),
  accountName: t.String(),
  role: RoleSchema,
});

const ResolvedFeaturesSchema = t.Object({
  can_export: t.Boolean(),
  can_invite_team: t.Boolean(),
  max_seats: t.Number(),
});

const RuntimeCapabilitiesSchema = t.Object({
  billing: t.Boolean(),
  notificationsSse: t.Boolean(),
  webPush: t.Boolean(),
});

/*
 * `/me` is a probe endpoint: a logged-out browser hits it on every
 * initial paint to discover whether a session exists. The two states
 * are exposed as a `user`-discriminated union — anonymous responds 200
 * with `user: null` (everything else absent); authenticated responds
 * 200 with the full profile. A 401 from `/me` always means the cookie
 * was present but invalid, which the UI treats as forced-logout.
 */
export const MeAnonymousResponse = t.Object({
  user: t.Null(),
});

export const MeAuthenticatedResponse = t.Object({
  user: UserProfileResponse,
  account: t.Object({ id: t.String(), name: t.String() }),
  role: RoleSchema,
  memberships: t.Array(MembershipSummarySchema),
  features: ResolvedFeaturesSchema,
  capabilities: RuntimeCapabilitiesSchema,
  authProviders: t.Array(t.String()),
  hasPasswordLogin: t.Boolean(),
});

export const MeResponse = t.Union([
  MeAnonymousResponse,
  MeAuthenticatedResponse,
]);
