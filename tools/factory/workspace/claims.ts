import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { nowIso } from "../clock";
import { isRecord, readJson } from "../state";
import { FACTORY_CONFIG } from "../factory.config";
import { isSlot, slotOfFileName } from "./paths.utils";

/** What a slot is held for. Written once, when the slot is claimed. */
export interface IClaim {
  readonly slot: number;
  readonly workspace: string;
  readonly issue: string;
  readonly branch: string;
  readonly createdAt: string;
}

export const slotsDirOf = (shared: string): string => join(shared, "slots");

export const claimPathOf = (shared: string, slot: number): string =>
  join(slotsDirOf(shared), `s${String(slot)}.json`);

export const parseClaim = (value: unknown): IClaim | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const { slot, workspace, issue, branch, createdAt } = value;

  return typeof slot === "number" &&
    isSlot(slot) &&
    typeof workspace === "string" &&
    typeof issue === "string" &&
    typeof branch === "string" &&
    typeof createdAt === "string"
    ? { slot, workspace, issue, branch, createdAt }
    : undefined;
};

export const readClaim = (shared: string, slot: number): IClaim | undefined =>
  parseClaim(readJson(claimPathOf(shared, slot)));

const errnoCodes = { exists: "EEXIST" } as const;

const isEexist = (error: unknown): boolean =>
  isRecord(error) && error.code === errnoCodes.exists;

/**
 * Claims one slot exclusively: the file is created with `wx`, so of two
 * claims made at once only one lands. False when the slot is already held.
 */
export const claimSlot = (
  shared: string,
  slot: number,
  claim: Omit<IClaim, "slot" | "createdAt">
): IClaim | undefined => {
  mkdirSync(slotsDirOf(shared), { recursive: true, mode: 0o700 });
  const record: IClaim = { slot, ...claim, createdAt: nowIso() };

  try {
    writeFileSync(
      claimPathOf(shared, slot),
      `${JSON.stringify(record, null, 2)}\n`,
      {
        flag: "wx",
        mode: 0o600,
      }
    );

    return record;
  } catch (error) {
    if (isEexist(error)) {
      return undefined;
    }

    throw error;
  }
};

/** Claims the lowest free slot 1..maxSlots, or undefined when all are held. */
export const claimFirstFreeSlot = (
  shared: string,
  claim: Omit<IClaim, "slot" | "createdAt">
): IClaim | undefined => {
  for (let slot = 1; slot <= FACTORY_CONFIG.maxSlots; slot += 1) {
    const won = claimSlot(shared, slot, claim);

    if (won !== undefined) {
      return won;
    }
  }

  return undefined;
};

export const releaseClaim = (shared: string, slot: number): void => {
  rmSync(claimPathOf(shared, slot), { force: true });
};

/** Every slot number with a claim file, for sweep and list. */
export const heldSlots = (shared: string): number[] => {
  try {
    return readdirSync(slotsDirOf(shared))
      .map(slotOfFileName)
      .filter((slot): slot is number => slot !== undefined)
      .sort((left, right) => left - right);
  } catch {
    return [];
  }
};
