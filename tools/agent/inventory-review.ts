import { createHash } from "node:crypto";
import type { InventoryLane } from "./inventory.types";

export interface IInventoryChange {
  lane: InventoryLane;
  before: string[];
  after: string[];
  added: string[];
  removed: string[];
}

export interface IInventoryReview {
  fingerprint: string;
  changes: IInventoryChange[];
  token: string;
}

/** Multiset subtraction preserves repeated cases rather than collapsing them. */
function difference(
  left: readonly string[],
  right: readonly string[]
): string[] {
  const remaining = [...right];

  return left
    .filter((identity) => {
      const index = remaining.indexOf(identity);

      if (index < 0) {
        return true;
      }

      remaining.splice(index, 1);

      return false;
    })
    .sort();
}

export function inventoryChange(
  lane: InventoryLane,
  before: string[],
  after: string[]
): IInventoryChange {
  return {
    lane,
    before: [...before].sort(),
    after: [...after].sort(),
    added: difference(after, before),
    removed: difference(before, after),
  };
}

export function inventoryReview(
  fingerprint: string,
  changes: IInventoryChange[]
): IInventoryReview {
  const ordered = [...changes].sort((left, right) =>
    left.lane.localeCompare(right.lane)
  );
  const token = createHash("sha256")
    .update(JSON.stringify({ fingerprint, changes: ordered }))
    .digest("hex");

  return { fingerprint, changes: ordered, token };
}
