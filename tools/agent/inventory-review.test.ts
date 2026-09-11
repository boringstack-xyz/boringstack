import { expect, test } from "bun:test";
import { inventoryChange, inventoryReview } from "./inventory-review";

test("inventory approval binds duplicates, substitutions, additions and the checkout", () => {
  const change = inventoryChange(
    "api.tests",
    ["control", "invariant", "invariant"],
    ["control", "replacement", "invariant"]
  );

  expect(change.added).toEqual(["replacement"]);
  expect(change.removed).toEqual(["invariant"]);
  const reviewed = inventoryReview("checkout", [change]);

  expect(inventoryReview("different-checkout", [change]).token).not.toBe(
    reviewed.token
  );
  expect(
    inventoryReview("checkout", [
      inventoryChange("api.tests", change.before, ["control", "invariant"]),
    ]).token
  ).not.toBe(reviewed.token);
  expect(
    inventoryReview("checkout", [
      inventoryChange(
        "api.tests",
        [...change.before].reverse(),
        [...change.after].reverse()
      ),
    ]).token
  ).toBe(reviewed.token);
});
