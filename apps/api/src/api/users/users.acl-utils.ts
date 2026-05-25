import { FEATURE_KEYS } from "../../lib/acl/acl.constants";
import type { FeatureKey } from "../../lib/acl/acl.types";
import { coerceRole, isRole } from "../../lib/acl/role-coercion";

export { coerceRole, isRole };

export const isFeatureKey = (raw: string): raw is FeatureKey => {
  for (const key of FEATURE_KEYS) {
    if (key === raw) {
      return true;
    }
  }

  return false;
};

export const filterToKnownFeatureKeys = <
  T extends { readonly featureKey: string },
>(
  rows: readonly T[]
): (Omit<T, "featureKey"> & { featureKey: FeatureKey })[] => {
  const filtered: (Omit<T, "featureKey"> & { featureKey: FeatureKey })[] = [];

  for (const row of rows) {
    if (isFeatureKey(row.featureKey)) {
      filtered.push({ ...row, featureKey: row.featureKey });
    }
  }

  return filtered;
};
