import type { FeatureKey, FeatureValue } from "./acl.types";

export interface IPlanFeatureRow {
  readonly featureKey: FeatureKey;
  readonly value: unknown;
}

export interface IFeatureOverrideRow {
  readonly featureKey: FeatureKey;
  readonly value: unknown;
  readonly expiresAt: Date | null;
  readonly revokedAt: Date | null;
}

export type ResolvedFeatures = {
  readonly [K in FeatureKey]: FeatureValue<K>;
};
