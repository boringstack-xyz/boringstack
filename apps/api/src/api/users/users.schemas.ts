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

export const MeResponse = t.Object({
  user: UserProfileResponse,
  account: t.Object({ id: t.String(), name: t.String() }),
  role: RoleSchema,
  memberships: t.Array(MembershipSummarySchema),
  features: ResolvedFeaturesSchema,
  capabilities: RuntimeCapabilitiesSchema,
  authProviders: t.Array(t.String()),
  hasPasswordLogin: t.Boolean(),
});
