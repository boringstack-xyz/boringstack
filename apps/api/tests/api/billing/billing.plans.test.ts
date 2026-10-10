import { describe, expect, test } from "bun:test";

import {
  PRO_SEAT_LIMIT,
  buildBuiltInPlans,
  featureKeysWithoutValue,
  findPlanNameByPriceId,
} from "../../../src/api/billing/billing.plans";
import { FEATURE_KEYS, FEATURES } from "../../../src/lib/acl/acl.constants";

const PRICES = {
  free: "price_free",
  proMonthly: "price_pro_monthly",
  proYearly: "price_pro_yearly",
};

const catalog = buildBuiltInPlans(PRICES);

const requirePlan = (name: string) => {
  const plan = catalog.find((candidate) => candidate.name === name);

  if (plan === undefined) {
    throw new Error(`plan ${name} missing from catalog`);
  }

  return plan;
};

describe("built-in plan catalog", () => {
  test("Pro carries a value for every feature key", () => {
    expect(featureKeysWithoutValue(requirePlan("Pro"))).toEqual([]);
  });

  test("Free carries no feature rows (missing keys resolve to FEATURES defaults)", () => {
    expect(Object.keys(requirePlan("Free").features)).toEqual([]);
  });

  test("every Pro value has the JSON shape its FEATURES kind requires", () => {
    const pro = requirePlan("Pro");

    for (const key of FEATURE_KEYS) {
      const json = JSON.stringify(pro.features[key]);

      if (FEATURES[key].kind === "boolean") {
        expect(json).toMatch(/^\{"bool":(?:true|false)\}$/u);
      } else {
        expect(json).toMatch(/^\{"number":\d+\}$/u);
      }
    }
  });

  test("Pro grants every boolean feature and the documented seat limit", () => {
    const pro = requirePlan("Pro");

    for (const key of FEATURE_KEYS) {
      if (FEATURES[key].kind === "boolean") {
        expect(pro.features[key]).toEqual({ bool: true });
      }
    }

    expect(PRO_SEAT_LIMIT).toBe(10);
    expect(pro.features.max_seats).toEqual({ number: PRO_SEAT_LIMIT });
  });

  test("Free is the default plan and Pro is not", () => {
    expect(requirePlan("Free").isDefault).toBe(true);
    expect(requirePlan("Pro").isDefault).toBe(false);
  });

  test("Pro exposes a monthly and a yearly price; Free exposes no yearly price", () => {
    const pro = requirePlan("Pro");

    expect(pro.prices).toEqual({
      month: PRICES.proMonthly,
      year: PRICES.proYearly,
    });
    expect(requirePlan("Free").prices.year).toBe("");
  });
});

describe("findPlanNameByPriceId", () => {
  test("maps both Pro prices to Pro", () => {
    expect(findPlanNameByPriceId(catalog, PRICES.proMonthly)).toBe("Pro");
    expect(findPlanNameByPriceId(catalog, PRICES.proYearly)).toBe("Pro");
  });

  test("maps the Free price to Free", () => {
    expect(findPlanNameByPriceId(catalog, PRICES.free)).toBe("Free");
  });

  test("returns undefined for an unknown price", () => {
    expect(findPlanNameByPriceId(catalog, "price_unknown")).toBeUndefined();
  });

  test("never matches an empty price id, even when the yearly price is unset", () => {
    const withoutYearly = buildBuiltInPlans({ ...PRICES, proYearly: "" });

    expect(findPlanNameByPriceId(withoutYearly, "")).toBeUndefined();
  });
});
