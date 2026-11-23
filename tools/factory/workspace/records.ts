import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { isRecord, readJson, writeJson } from "../state";
import { slotOfFileName } from "./paths.utils";

/*
 * Per-slot records every checkout on the machine reads: status lines under
 * <shared>/status, preview routes under <shared>/preview. One JSON file per
 * slot, written atomically, so a reader never sees half of one.
 */
export const recordPathOf = (
  shared: string,
  kind: "status" | "preview",
  slot: number
): string => join(shared, kind, `s${String(slot)}.json`);

export const readRecord = (
  shared: string,
  kind: "status" | "preview",
  slot: number
): Record<string, unknown> | undefined => {
  const value = readJson(recordPathOf(shared, kind, slot));

  return isRecord(value) ? value : undefined;
};

export const writeRecord = (
  shared: string,
  kind: "status" | "preview",
  slot: number,
  value: Record<string, unknown>
): void => {
  writeJson(recordPathOf(shared, kind, slot), value);
};

export const removeRecord = (
  shared: string,
  kind: "status" | "preview",
  slot: number
): void => {
  rmSync(recordPathOf(shared, kind, slot), { force: true });
};

/** Every slot number that has a record of this kind. */
export const recordedSlots = (
  shared: string,
  kind: "status" | "preview"
): number[] => {
  try {
    return readdirSync(join(shared, kind))
      .map(slotOfFileName)
      .filter((slot): slot is number => slot !== undefined);
  } catch {
    return [];
  }
};
