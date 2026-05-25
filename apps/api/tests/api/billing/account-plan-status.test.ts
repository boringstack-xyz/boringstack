import { describe, expect, test } from "bun:test";

import { selectEffectiveFeatures } from "../../../src/api/billing/account-plan-status";
import type { IPlanFeatureRow } from "../../../src/lib/acl/feature-resolution.types";

const PAID: readonly IPlanFeatureRow[] = [
  { featureKey: "can_export", value: { bool: true } },
  { featureKey: "max_widgets", value: { number: 1000 } },
];

const FREE: readonly IPlanFeatureRow[] = [
  { featureKey: "can_export", value: { bool: false } },
  { featureKey: "max_widgets", value: { number: 5 } },
];

const NOW = Date.UTC(2026, 5, 17);

describe("selectEffectiveFeatures — status → effective plan", () => {
  test("active and trialing → paid features", () => {
    expect(selectEffectiveFeatures("active", PAID, FREE, null, NOW)).toBe(PAID);
    expect(selectEffectiveFeatures("trialing", PAID, FREE, null, NOW)).toBe(
      PAID
    );
  });

  test("past_due stays on paid features (grace handled at write-time at a higher layer)", () => {
    expect(selectEffectiveFeatures("past_due", PAID, FREE, null, NOW)).toBe(
      PAID
    );
  });

  test("unpaid, paused, incomplete fall back to free features", () => {
    expect(selectEffectiveFeatures("unpaid", PAID, FREE, null, NOW)).toBe(FREE);
    expect(selectEffectiveFeatures("paused", PAID, FREE, null, NOW)).toBe(FREE);
    expect(selectEffectiveFeatures("incomplete", PAID, FREE, null, NOW)).toBe(
      FREE
    );
  });

  test("canceled keeps paid features until currentPeriodEnd, then drops to free", () => {
    const future = new Date(NOW + 86_400_000);
    const past = new Date(NOW - 86_400_000);

    expect(selectEffectiveFeatures("canceled", PAID, FREE, future, NOW)).toBe(
      PAID
    );
    expect(selectEffectiveFeatures("canceled", PAID, FREE, past, NOW)).toBe(
      FREE
    );
    expect(selectEffectiveFeatures("canceled", PAID, FREE, null, NOW)).toBe(
      FREE
    );
  });
});
