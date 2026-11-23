/*
 * What `factory fleet` reads: every factory stack's containers and resource
 * use from Docker, joined with the machine-wide slot files and each claimed
 * workspace's latest verify result. Reads only; nothing runs in the background.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";

import type { IFactoryContext } from "../context";
import { readJson } from "../state";
import { listStackContainers, readStats } from "./docker";
import { summarizeStack, type IStackSummary } from "./fleet.utils";
import type { ProcessRunner } from "./process";
import {
  type ISlotClaim,
  type IStatusLine,
  type IVerifyResult,
  parseClaim,
  parsePreviewUrl,
  parseStatusLine,
  parseVerify,
  slotOfFileName,
} from "./slots.utils";

export interface IFleetSnapshot {
  /** False when Docker could not be asked: the fleet is unknown, not empty. */
  readonly dockerAvailable: boolean;
  readonly stacks: readonly IStackSummary[];
}

/** File names in a folder; none when the folder does not exist yet. */
const namesIn = (folder: string): string[] => {
  try {
    return readdirSync(folder);
  } catch {
    return [];
  }
};

/** The slot-keyed contents of one shared folder, each file parsed by `read`. */
const readSlotFiles = <T>(
  folder: string,
  read: (slot: number, body: unknown) => T | null
): Map<number, T> => {
  const names = namesIn(folder);

  return new Map(
    names.flatMap((name): [number, T][] => {
      const slot = slotOfFileName(name);
      const parsed =
        slot === null ? null : read(slot, readJson(join(folder, name)));

      return slot === null || parsed === null ? [] : [[slot, parsed]];
    })
  );
};

/** The workspace's latest verify run, read from the checkout that holds the stack. */
const verifyOf = (claim: ISlotClaim | undefined): IVerifyResult | null =>
  claim === undefined
    ? null
    : parseVerify(
        readJson(
          join(
            claim.workspace,
            ".agent-state",
            "factory",
            "verify",
            "latest.json"
          )
        )
      );

/** Every slot claim on the machine, by slot number. */
export const readClaims = (sharedDir: string): Map<number, ISlotClaim> =>
  readSlotFiles(join(sharedDir, "slots"), parseClaim);

export const collectFleet = (
  context: IFactoryContext,
  run: ProcessRunner
): IFleetSnapshot => {
  const containers = listStackContainers(run, context.config.project);

  if (containers === null) {
    return { dockerAvailable: false, stacks: [] };
  }

  const claims = readClaims(context.sharedDir);
  const statuses = readSlotFiles<IStatusLine>(
    join(context.sharedDir, "status"),
    (_slot, body) => parseStatusLine(body)
  );
  const previews = readSlotFiles<string>(
    join(context.sharedDir, "preview"),
    (_slot, body) => parsePreviewUrl(body)
  );
  const stats = readStats(
    run,
    containers
      .filter((container) => container.state === "running")
      .map((container) => container.name)
  );
  const slots = [
    ...new Set(containers.map((container) => container.slot)),
  ].sort((left, right) => left - right);

  return {
    dockerAvailable: true,
    stacks: slots.map((slot) => {
      const claim = claims.get(slot);

      return summarizeStack({
        slot,
        containers: containers.filter((container) => container.slot === slot),
        stats,
        claim: claim ?? null,
        status: statuses.get(slot) ?? null,
        previewUrl: previews.get(slot) ?? null,
        lastVerify: verifyOf(claim),
        prefix: context.config.project,
        bases: context.config.portBases,
      });
    }),
  };
};
