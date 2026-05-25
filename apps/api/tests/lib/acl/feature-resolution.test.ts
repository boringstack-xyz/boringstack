import { describe, expect, test } from "bun:test";

import { FEATURES } from "../../../src/lib/acl/acl.constants";
import { resolveFeatures } from "../../../src/lib/acl/feature-resolution";
import type {
  IFeatureOverrideRow,
  IPlanFeatureRow,
} from "../../../src/lib/acl/feature-resolution.types";

const NOW = new Date("2026-06-01T12:00:00.000Z");
const PAST = new Date("2026-05-31T12:00:00.000Z");
const FUTURE = new Date("2026-07-01T12:00:00.000Z");

const emptyPlan: readonly IPlanFeatureRow[] = [];
const emptyOverrides: readonly IFeatureOverrideRow[] = [];

const planRow = (
  featureKey: IPlanFeatureRow["featureKey"],
  value: unknown
): IPlanFeatureRow => ({ featureKey, value });

const overrideRow = (
  featureKey: IFeatureOverrideRow["featureKey"],
  value: unknown,
  opts: Partial<Pick<IFeatureOverrideRow, "expiresAt" | "revokedAt">> = {}
): IFeatureOverrideRow => ({
  featureKey,
  value,
  expiresAt: opts.expiresAt ?? null,
  revokedAt: opts.revokedAt ?? null,
});

describe("resolveFeatures — catalog defaults", () => {
  test("empty plan + empty overrides returns the catalog default for every key", () => {
    const resolved = resolveFeatures(emptyPlan, emptyOverrides, NOW);

    expect(resolved.can_export).toBe(false);
    expect(resolved.can_invite_team).toBe(false);
    expect(resolved.max_seats).toBe(FEATURES.max_seats.default);
    expect(resolved.max_widgets).toBe(FEATURES.max_widgets.default);
  });
});

describe("resolveFeatures — plan_features fallback", () => {
  test("plan_features value wins over catalog default", () => {
    const resolved = resolveFeatures(
      [planRow("max_widgets", { number: 10 })],
      emptyOverrides,
      NOW
    );

    expect(resolved.max_widgets).toBe(10);
    expect(resolved.max_seats).toBe(FEATURES.max_seats.default);
  });

  test("boolean plan_features value wins over catalog default", () => {
    const resolved = resolveFeatures(
      [planRow("can_export", { bool: true })],
      emptyOverrides,
      NOW
    );

    expect(resolved.can_export).toBe(true);
  });
});

describe("resolveFeatures — override priority", () => {
  test("active override beats plan_features", () => {
    const resolved = resolveFeatures(
      [planRow("max_widgets", { number: 10 })],
      [overrideRow("max_widgets", { number: 50 })],
      NOW
    );

    expect(resolved.max_widgets).toBe(50);
  });

  test("boolean override flips false back to true", () => {
    const resolved = resolveFeatures(
      [planRow("can_export", { bool: false })],
      [overrideRow("can_export", { bool: true })],
      NOW
    );

    expect(resolved.can_export).toBe(true);
  });

  test("override with expiresAt in the past falls through to plan_features", () => {
    const resolved = resolveFeatures(
      [planRow("max_widgets", { number: 10 })],
      [overrideRow("max_widgets", { number: 50 }, { expiresAt: PAST })],
      NOW
    );

    expect(resolved.max_widgets).toBe(10);
  });

  test("override with expiresAt in the future is still active", () => {
    const resolved = resolveFeatures(
      [planRow("max_widgets", { number: 10 })],
      [overrideRow("max_widgets", { number: 50 }, { expiresAt: FUTURE })],
      NOW
    );

    expect(resolved.max_widgets).toBe(50);
  });

  test("revoked override is ignored even when expiresAt is null", () => {
    const resolved = resolveFeatures(
      [planRow("max_widgets", { number: 10 })],
      [overrideRow("max_widgets", { number: 50 }, { revokedAt: PAST })],
      NOW
    );

    expect(resolved.max_widgets).toBe(10);
  });

  test("expired override falls through to catalog default when plan has no row either", () => {
    const resolved = resolveFeatures(
      emptyPlan,
      [overrideRow("max_widgets", { number: 50 }, { expiresAt: PAST })],
      NOW
    );

    expect(resolved.max_widgets).toBe(FEATURES.max_widgets.default);
  });
});

describe("resolveFeatures — runtime shape validation", () => {
  test("limit feature with non-numeric jsonb value throws", () => {
    expect(() =>
      resolveFeatures(
        [planRow("max_widgets", { bool: true })],
        emptyOverrides,
        NOW
      )
    ).toThrow(/max_widgets/u);
  });

  test("boolean feature with non-boolean jsonb value throws", () => {
    expect(() =>
      resolveFeatures(
        [planRow("can_export", { number: 5 })],
        emptyOverrides,
        NOW
      )
    ).toThrow(/can_export/u);
  });

  test("override with a malformed jsonb shape throws — never silently falls through", () => {
    expect(() =>
      resolveFeatures(
        emptyPlan,
        [overrideRow("max_widgets", { wrong_key: 50 })],
        NOW
      )
    ).toThrow(/max_widgets/u);
  });
});
