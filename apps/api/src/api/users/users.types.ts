import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

import type { users } from "../../clients/postgres/schema";
import type { Role } from "../../lib/acl/acl.types";
import type { ResolvedFeatures } from "../../lib/acl/feature-resolution.types";

export type IUser = InferSelectModel<typeof users>;
export type ICreateUserData = InferInsertModel<typeof users>;
export type IUpdateUserData = Partial<InferInsertModel<typeof users>>;

export interface IPublicUserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IMembershipSummary {
  accountId: string;
  accountName: string;
  role: Role;
}

export interface IMeResponse {
  user: IPublicUserProfile;
  account: { id: string; name: string };
  role: Role;
  memberships: IMembershipSummary[];
  features: ResolvedFeatures;
  capabilities: {
    billing: boolean;
    notificationsSse: boolean;
    webPush: boolean;
  };
  authProviders: string[];
  hasPasswordLogin: boolean;
}
