export type InventoryLane = "api.tests" | "ui.tests" | "ui.e2e";

export interface IInventory {
  schemaVersion: 1;
  cases: string[];
}

export interface IInventoryObservation extends IInventory {
  checkout: { commit: string; fingerprint: string };
}
