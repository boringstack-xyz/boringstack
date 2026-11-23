/*
 * Pure parts of the Stop gate: which units this session changed, which of
 * those have not passed verify at their current state, the blocked
 * challenge, the loop breaker and the decision. Ported from the Dreamdata
 * factory (agents/src/stop.utils.ts), units instead of repos.
 */
import type { UnitStates } from "../record/units";

/**
 * The session-start record after this run. A new session, a startup or a
 * clear records every unit as it is now; a resumed session keeps its record
 * and adds units it lacks. Undefined when nothing needs writing.
 */
export const nextSessionStart = (input: {
  existing: UnitStates | undefined;
  current: UnitStates;
  source: string | undefined;
}): UnitStates | undefined => {
  const { existing, current, source } = input;

  if (existing === undefined || source === "startup" || source === "clear") {
    return current;
  }

  const missing = Object.keys(current).filter(
    (path) => !Object.hasOwn(existing, path)
  );

  return missing.length === 0
    ? undefined
    : {
        ...existing,
        ...Object.fromEntries(
          missing.map((path) => [path, current[path] ?? ""])
        ),
      };
};

/** Units this session changed: all without a start record, else those that differ. */
export const changedThisSession = (
  current: UnitStates,
  sessionStart: UnitStates | undefined
): string[] =>
  Object.keys(current).filter(
    (path) =>
      sessionStart === undefined ||
      (Object.hasOwn(sessionStart, path) &&
        sessionStart[path] !== current[path])
  );

/**
 * Units this session changed whose current state has not passed verify.
 * `untouched` units (identical to the base branch) never count.
 */
export const pendingUnits = (input: {
  current: UnitStates;
  green: UnitStates;
  sessionStart: UnitStates | undefined;
  untouched: ReadonlySet<string>;
}): string[] => {
  const changed = new Set(
    changedThisSession(input.current, input.sessionStart)
  );

  return Object.keys(input.current)
    .filter(
      (path) =>
        changed.has(path) &&
        !input.untouched.has(path) &&
        input.green[path] !== input.current[path]
    )
    .sort();
};

/** The verdict of the last gate run over the pending units. */
export interface IGateRun {
  readonly ok: boolean;
  readonly summary: string;
  readonly evidence: string;
}

export type StopDecision =
  { stop: true; note: string } | { stop: false; reason: string };

const BLOCKED_CHALLENGE =
  "Before stopping as blocked: is this something only a person can provide (an account, a credential, a consent screen, a product decision with no sensible default)? A technical choice is not: make it, delete .agent-state/factory/BLOCKED and carry on. Is there other work left that does not need it? Do that first. If it truly needs a person and nothing else is left, make sure the blocker is written on the issue, then stop again.";

/** Whether this BLOCKED text was already challenged once. */
export const alreadyChallenged = (
  saved: string | undefined,
  blocked: string
): boolean => saved?.trim() === blocked.trim();

export const decideStop = (input: {
  blocked: string | undefined;
  blockedConfirmed: boolean;
  pending: readonly string[];
  sessionId: string | undefined;
  gateRunning: boolean;
  gate: IGateRun | undefined;
  recordProblems: readonly string[];
  branch: string;
}): StopDecision => {
  if (input.blocked !== undefined && !input.blockedConfirmed) {
    return { stop: false, reason: BLOCKED_CHALLENGE };
  }

  if (input.blocked !== undefined) {
    return {
      stop: true,
      note: `stopping as blocked: ${input.blocked.trim() === "" ? "(no reason given)" : input.blocked.trim()}`,
    };
  }

  /* A run in progress decides, not the verdict of the one before it. */
  if (input.pending.length > 0 && input.gateRunning) {
    return {
      stop: true,
      note: "factory gate is running; its result arrives when it ends",
    };
  }

  if (input.pending.length > 0 && input.gate === undefined) {
    return {
      stop: false,
      reason: `Before finishing, start \`bun run factory gate${input.sessionId === undefined ? "" : ` --session ${input.sessionId}`}\` in the background (never in the foreground: the person cannot talk to you while it runs). It verifies what you changed (${input.pending.join(", ")}) and records the pass. Tell the person the checks are running, then keep answering; you are told when it ends.`,
    };
  }

  if (input.pending.length > 0 && input.gate !== undefined && !input.gate.ok) {
    return {
      stop: false,
      reason: [
        "Not done: factory verify is red for what you changed. Fix it, then stop again.",
        input.gate.summary,
        `Evidence: ${input.gate.evidence}`,
        "What the services logged: `bun run factory logs --errors --since 15m`.",
        "If only a person can unblock this, write it on the issue and the reason to .agent-state/factory/BLOCKED.",
      ].join("\n"),
    };
  }

  if (input.recordProblems.length > 0) {
    return {
      stop: false,
      reason: [
        `Before finishing, complete the verification record of ${input.branch}, which you pushed: what you checked, how, and what you could not verify.`,
        ...input.recordProblems.map((problem) => `- ${problem}`),
        `(bun run factory verification new ${input.branch}, fill it in, then bun run factory verification check ${input.branch})`,
      ].join("\n"),
    };
  }

  return {
    stop: true,
    note:
      input.pending.length === 0
        ? "everything this session changed has passed verify"
        : `verify passed for ${input.pending.join(", ")}`,
  };
};

/** How many identical blocks in a row before the gate lets the session stop. */
export const MAX_IDENTICAL_BLOCKS = 3;

export interface IBlockRecord {
  readonly reason: string;
  readonly count: number;
}

/** Loop breaker: the third identical block in a row lets the session stop. */
export const nextBlock = (input: {
  reason: string;
  stopHookActive: boolean;
  previous: IBlockRecord | undefined;
}): { block: true; record: IBlockRecord } | { block: false } => {
  const count =
    input.stopHookActive && input.previous?.reason === input.reason
      ? input.previous.count + 1
      : 1;

  return count >= MAX_IDENTICAL_BLOCKS
    ? { block: false }
    : { block: true, record: { reason: input.reason, count } };
};
