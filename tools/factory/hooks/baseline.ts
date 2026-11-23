import type { IFactoryContext } from "../context";
import { readSessionStart, sessionFile } from "../record/session";
import { fingerprintAll } from "../record/units";
import { type ICommandOutcome, ok } from "../result";
import { writeJson } from "../state";
import type { IHookPayload } from "./payload";
import { nextSessionStart } from "./stop.utils";

/** SessionStart: records each unit as it is now, so the Stop gate knows what this session changed. */
export const baselineHook = (
  payload: IHookPayload,
  context: IFactoryContext
): ICommandOutcome => {
  const next = nextSessionStart({
    existing: readSessionStart(context, payload.sessionId),
    current: fingerprintAll(context.root),
    source: payload.source,
  });

  if (next !== undefined) {
    writeJson(sessionFile(context, payload.sessionId), next);
  }

  return ok("");
};
