import { join } from "node:path";

import type { IFactoryContext } from "../context";
import { currentBranch, DETACHED_HEAD, isPushed } from "../git";
import { gateRunning, readGateResult } from "../record/gate";
import { snapshot } from "../record/session";
import { recordProblems } from "../record/verification";
import { type ICommandOutcome, ok } from "../result";
import { isRecord, readJson, readText, writeJson, writeText } from "../state";
import type { IHookPayload } from "./payload";
import {
  alreadyChallenged,
  decideStop,
  type IBlockRecord,
  MAX_IDENTICAL_BLOCKS,
  nextBlock,
  pendingUnits,
} from "./stop.utils";

/*
 * The Stop hook: the session may finish only when everything it changed has
 * passed verify at its current state and a pushed branch has a complete
 * verification record. Prints `{"decision":"block","reason":…}` to keep the
 * agent working; silent when it may stop.
 */
const blockedFile = (context: IFactoryContext): string =>
  join(context.stateDir, "BLOCKED");
const challengedFile = (context: IFactoryContext): string =>
  join(context.stateDir, "BLOCKED.challenged");
const lastBlockFile = (context: IFactoryContext): string =>
  join(context.stateDir, "last-block.json");

const readBlock = (context: IFactoryContext): IBlockRecord | undefined => {
  const parsed = readJson(lastBlockFile(context));

  return isRecord(parsed) &&
    typeof parsed.reason === "string" &&
    typeof parsed.count === "number"
    ? { reason: parsed.reason, count: parsed.count }
    : undefined;
};

export const stopHook = (
  payload: IHookPayload,
  context: IFactoryContext
): ICommandOutcome => {
  const units = snapshot(context, payload.sessionId);
  const pending = pendingUnits(units);
  const gate = readGateResult(context);
  const gateApplies =
    gate !== undefined &&
    pending.every((path) => gate.states[path] === units.current[path]);
  const branch = currentBranch(context.root);
  const protectedBranches: readonly string[] = context.config.protectedBranches;
  const pushed =
    !protectedBranches.includes(branch) &&
    branch !== DETACHED_HEAD &&
    isPushed(context.root, branch);
  const blocked = readText(blockedFile(context));
  const confirmed =
    blocked !== undefined &&
    alreadyChallenged(readText(challengedFile(context)), blocked);

  if (blocked !== undefined && !confirmed) {
    writeText(challengedFile(context), blocked);
  }

  const decision = decideStop({
    blocked,
    blockedConfirmed: confirmed,
    pending,
    sessionId: payload.sessionId,
    gateRunning: gateRunning(context),
    gate: gateApplies ? gate : undefined,
    recordProblems: pushed ? recordProblems(context, branch) : [],
    branch,
  });

  if (decision.stop) {
    writeJson(lastBlockFile(context), {});

    return ok("", decision);
  }

  const next = nextBlock({
    reason: decision.reason,
    stopHookActive: payload.stopHookActive,
    previous: readBlock(context),
  });

  if (!next.block) {
    writeJson(lastBlockFile(context), {});
    console.error(
      `[factory stop gate] letting the session stop after ${String(MAX_IDENTICAL_BLOCKS)} identical blocks; unresolved:\n${decision.reason}`
    );

    return ok("", decision);
  }

  writeJson(lastBlockFile(context), next.record);
  console.log(JSON.stringify({ decision: "block", reason: decision.reason }));

  return ok("", decision);
};
