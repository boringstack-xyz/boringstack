import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

import { nowIso } from "../clock";
import type { IFactoryContext } from "../context";
import { isRecord, readJson, writeJson } from "../state";

/*
 * One verification at a time per checkout, gate or plain verify alike. The
 * Stop hook reads the same lock to know a verdict is on its way.
 */
export const gateLockFile = (context: IFactoryContext): string =>
  join(context.stateDir, "gate.lock");

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);

    return true;
  } catch {
    return false;
  }
};

export const gateRunning = (context: IFactoryContext): boolean => {
  const lock = readJson(gateLockFile(context));

  return isRecord(lock) && typeof lock.pid === "number" && isAlive(lock.pid);
};

/** Runs `work` holding the lock; undefined when another run holds it. */
export const withVerifyLock = <T>(
  context: IFactoryContext,
  work: () => T
): T | undefined => {
  if (gateRunning(context)) {
    return undefined;
  }

  writeJson(gateLockFile(context), { pid: process.pid, startedAt: nowIso() });

  try {
    return work();
  } finally {
    if (existsSync(gateLockFile(context))) {
      rmSync(gateLockFile(context));
    }
  }
};
