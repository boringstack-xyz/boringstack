import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

import { nowIso } from "../clock";
import type { IFactoryContext } from "../context";
import { pendingUnits } from "../hooks/stop.utils";
import { blocked, failed, type ICommandOutcome, ok } from "../result";
import { isRecord, readJson, writeJson } from "../state";
import { snapshot } from "./session";
import { describeRun, verify } from "./verify";

/*
 * `factory gate`: verifies what this session changed and has not yet passed,
 * and leaves its verdict for the Stop hook. Meant to run in the background;
 * a lock file tells the hook it is still running.
 */
export const gateLockFile = (context: IFactoryContext): string =>
  join(context.stateDir, "gate.lock");

export const gateResultFile = (context: IFactoryContext): string =>
  join(context.stateDir, "gate.json");

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

export interface IGateResult {
  readonly ok: boolean;
  readonly summary: string;
  readonly evidence: string;
  /** The unit states the verdict is about: stale once any of them changes. */
  readonly states: Readonly<Record<string, string>>;
}

export const readGateResult = (
  context: IFactoryContext
): IGateResult | undefined => {
  const parsed = readJson(gateResultFile(context));

  return isRecord(parsed) &&
    typeof parsed.ok === "boolean" &&
    typeof parsed.summary === "string" &&
    typeof parsed.evidence === "string" &&
    isRecord(parsed.states)
    ? {
        ok: parsed.ok,
        summary: parsed.summary,
        evidence: parsed.evidence,
        states: Object.fromEntries(
          Object.entries(parsed.states).map(([key, value]) => [
            key,
            String(value),
          ])
        ),
      }
    : undefined;
};

export const gateCommand = (
  args: readonly string[],
  context: IFactoryContext
): Promise<ICommandOutcome> => {
  const sessionIndex = args.indexOf("--session");
  const sessionId = sessionIndex >= 0 ? args[sessionIndex + 1] : undefined;

  if (gateRunning(context)) {
    return Promise.resolve(
      blocked("a factory gate is already running in this checkout")
    );
  }

  const units = snapshot(context, sessionId);
  const pending = pendingUnits(units);

  if (pending.length === 0) {
    return Promise.resolve(
      ok("everything this session changed has passed verify")
    );
  }

  writeJson(gateLockFile(context), {
    pid: process.pid,
    startedAt: nowIso(),
  });

  try {
    const result = verify(context, { units: pending, compareWithBase: true });
    const passed = result.status === "passed" || result.status === "warn";
    const evidence = join(context.stateDir, "verify", result.runId);

    writeJson(gateResultFile(context), {
      ok: passed,
      summary: describeRun(result),
      evidence,
      states: Object.fromEntries(
        pending.map((path) => [path, units.current[path] ?? ""])
      ),
    });

    return Promise.resolve(
      passed
        ? ok(describeRun(result), result)
        : failed(describeRun(result), result)
    );
  } finally {
    if (existsSync(gateLockFile(context))) {
      rmSync(gateLockFile(context));
    }
  }
};
