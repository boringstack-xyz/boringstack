import type { IFactoryCommand } from "../command.types";
import type { IFactoryContext } from "../context";
import { baselineHook } from "./baseline";
import { guardHook } from "./guard";
import { type IHookPayload, readPayload } from "./payload";
import { stopHook } from "./stop";

/*
 * Agent harness hooks (Claude Code .claude/settings.json, Codex
 * .codex/hooks.json). Each reads the hook payload on stdin and judges the
 * checkout this CLI lives in, which is the session's project directory.
 */
const hook = (
  name: string,
  summary: string,
  handle: (
    payload: IHookPayload,
    context: IFactoryContext
  ) => ReturnType<typeof guardHook>
): IFactoryCommand => ({
  name,
  summary,
  run: async (_args, context) => handle(await readPayload(), context),
});

export const hookCommands: readonly IFactoryCommand[] = [
  hook(
    "hook guard",
    "PreToolUse tripwires: force push, push to main, secret reads, checks in dev containers",
    guardHook
  ),
  hook(
    "hook stop",
    "Stop gate: changed units verified and the pushed branch's record complete",
    stopHook
  ),
  hook(
    "hook baseline",
    "SessionStart: remember each unit's state as this session starts",
    baselineHook
  ),
];
