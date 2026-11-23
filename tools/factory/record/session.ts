import { join } from "node:path";

import type { IFactoryContext } from "../context";
import { parseStringRecord, readJson } from "../state";
import {
  changedSince,
  fingerprintAll,
  presentUnits,
  type UnitStates,
} from "./units";
import { baseCommit, readGreen } from "./verify";

/** Where a session's start record lives; without an id, the checkout-wide one. */
export const sessionFile = (
  context: IFactoryContext,
  sessionId: string | undefined
): string =>
  join(context.stateDir, "sessions", `${sessionId ?? "default"}.json`);

export const readSessionStart = (
  context: IFactoryContext,
  sessionId: string | undefined
): UnitStates | undefined =>
  parseStringRecord(readJson(sessionFile(context, sessionId)));

/** Units identical to the base branch: nobody changed them, so they never need a run. */
export const untouchedUnits = (context: IFactoryContext): Set<string> => {
  const changed = new Set(
    changedSince(context.root, baseCommit(context.root)).map(
      (unit) => unit.path
    )
  );

  return new Set(
    presentUnits(context.root)
      .map((unit) => unit.path)
      .filter((path) => !changed.has(path))
  );
};

export interface IUnitSnapshot {
  readonly current: UnitStates;
  readonly green: UnitStates;
  readonly sessionStart: UnitStates | undefined;
  readonly untouched: ReadonlySet<string>;
}

export const snapshot = (
  context: IFactoryContext,
  sessionId: string | undefined
): IUnitSnapshot => ({
  current: fingerprintAll(context.root),
  green: readGreen(context),
  sessionStart: readSessionStart(context, sessionId),
  untouched: untouchedUnits(context),
});
