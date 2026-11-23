import type { IFactoryCommand } from "../command.types";
import { notBuilt } from "../not-built";

/*
 * Agent harness hooks (Claude Code .claude/settings.json, Codex
 * .codex/hooks.json). Each reads the hook payload on stdin.
 */
const stub = (name: string, summary: string): IFactoryCommand => ({
  name,
  summary,
  run: () => Promise.resolve(notBuilt(name)),
});

export const hookCommands: readonly IFactoryCommand[] = [
  stub(
    "hook guard",
    "PreToolUse tripwires: force push, push to main, secret reads, branch switches"
  ),
  stub(
    "hook stop",
    "Stop gate: changed apps verified and the branch's record complete"
  ),
  stub("hook baseline", "SessionStart: remember where this session started"),
];
