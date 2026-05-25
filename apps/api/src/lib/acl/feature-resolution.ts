import { ApiErrors } from "../errors";

import { FEATURES } from "./acl.constants";
import type { FeatureKey } from "./acl.types";
import type {
  IFeatureOverrideRow,
  IPlanFeatureRow,
  ResolvedFeatures,
} from "./feature-resolution.types";

const isBoolValue = (raw: unknown): raw is { bool: boolean } => {
  if (typeof raw !== "object" || raw === null) {
    return false;
  }

  if (!("bool" in raw)) {
    return false;
  }

  return typeof raw.bool === "boolean";
};

const isNumberValue = (raw: unknown): raw is { number: number } => {
  if (typeof raw !== "object" || raw === null) {
    return false;
  }

  if (!("number" in raw)) {
    return false;
  }

  return typeof raw.number === "number";
};

const isActiveOverride = (row: IFeatureOverrideRow, now: Date): boolean => {
  if (row.revokedAt !== null) {
    return false;
  }

  if (row.expiresAt !== null && row.expiresAt.getTime() <= now.getTime()) {
    return false;
  }

  return true;
};

const findValueForKey = (
  key: FeatureKey,
  planFeatures: readonly IPlanFeatureRow[],
  overrides: readonly IFeatureOverrideRow[],
  now: Date
): { source: "override" | "plan"; value: unknown } | null => {
  const activeOverride = overrides.find(
    (row) => row.featureKey === key && isActiveOverride(row, now)
  );

  if (activeOverride !== undefined) {
    return { source: "override", value: activeOverride.value };
  }

  const planRow = planFeatures.find((row) => row.featureKey === key);

  if (planRow !== undefined) {
    return { source: "plan", value: planRow.value };
  }

  return null;
};

const resolveBooleanFeature = (
  key: FeatureKey,
  fallback: boolean,
  planFeatures: readonly IPlanFeatureRow[],
  overrides: readonly IFeatureOverrideRow[],
  now: Date
): boolean => {
  const hit = findValueForKey(key, planFeatures, overrides, now);

  if (hit === null) {
    return fallback;
  }

  if (!isBoolValue(hit.value)) {
    throw ApiErrors.database(
      `Feature ${key} expected jsonb of shape { bool: boolean } from ${hit.source}; got ${JSON.stringify(hit.value)}`
    );
  }

  return hit.value.bool;
};

const resolveLimitFeature = (
  key: FeatureKey,
  fallback: number,
  planFeatures: readonly IPlanFeatureRow[],
  overrides: readonly IFeatureOverrideRow[],
  now: Date
): number => {
  const hit = findValueForKey(key, planFeatures, overrides, now);

  if (hit === null) {
    return fallback;
  }

  if (!isNumberValue(hit.value)) {
    throw ApiErrors.database(
      `Feature ${key} expected jsonb of shape { number: number } from ${hit.source}; got ${JSON.stringify(hit.value)}`
    );
  }

  return hit.value.number;
};

export function resolveFeatures(
  planFeatures: readonly IPlanFeatureRow[],
  overrides: readonly IFeatureOverrideRow[],
  now: Date = new Date()
): ResolvedFeatures {
  return {
    can_export: resolveBooleanFeature(
      "can_export",
      FEATURES.can_export.default,
      planFeatures,
      overrides,
      now
    ),
    can_invite_team: resolveBooleanFeature(
      "can_invite_team",
      FEATURES.can_invite_team.default,
      planFeatures,
      overrides,
      now
    ),
    max_seats: resolveLimitFeature(
      "max_seats",
      FEATURES.max_seats.default,
      planFeatures,
      overrides,
      now
    ),
    max_widgets: resolveLimitFeature(
      "max_widgets",
      FEATURES.max_widgets.default,
      planFeatures,
      overrides,
      now
    ),
  };
}
