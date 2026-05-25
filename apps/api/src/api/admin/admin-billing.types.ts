import type { FeatureKey } from "../../lib/acl/acl.types";

export interface IGrantFeatureInput {
  readonly accountId: string;
  readonly featureKey: FeatureKey;
  readonly value: { bool: boolean } | { number: number };
  readonly expiresAt: string | null;
  readonly visibility: "public" | "internal";
  readonly reason: string;
  readonly grantedByUserId: string;
  readonly grantedByMembershipId: string | null;
}

export interface IRevokeFeatureInput {
  readonly overrideId: string;
  readonly revokedByUserId: string;
  readonly reason: string;
}

export interface IGrantPlanInput {
  readonly accountId: string;
  readonly planId: number;
  readonly expiresAt: string | null;
  readonly reason: string;
  readonly grantedByUserId: string;
}
