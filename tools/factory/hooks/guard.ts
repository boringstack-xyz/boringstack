import type { IFactoryContext } from "../context";
import { currentBranch, isMainWorktree } from "../git";
import { ok, type ICommandOutcome } from "../result";
import {
  checkBash,
  checkRead,
  checkSearch,
  type Decision,
} from "./guard.utils";
import type { IHookPayload } from "./payload";

/** The guard's verdict on one tool call. */
export const decideToolCall = (
  payload: IHookPayload,
  context: IFactoryContext
): Decision => {
  const policy = context.config;
  const input = payload.toolInput;

  switch (payload.toolName) {
    case "Bash": {
      const command = input.command;

      return typeof command === "string"
        ? checkBash(command, {
            cwd: payload.cwd ?? context.root,
            home: context.env.home ?? "",
            policy,
            checkout: (dir) => ({
              branch: currentBranch(dir),
              shared: context.env.sharedCheckout && isMainWorktree(dir),
            }),
          })
        : { allow: true };
    }

    case "Read": {
      const path = input.file_path;

      return typeof path === "string"
        ? checkRead(path, policy)
        : { allow: true };
    }

    case "Grep":
    case "Glob":
      return checkSearch(payload.toolName, input, policy);
    default:
      return { allow: true };
  }
};

/** PreToolUse: prints a deny decision in the hook protocol; silent on allow. */
export const guardHook = (
  payload: IHookPayload,
  context: IFactoryContext
): ICommandOutcome => {
  const decision = decideToolCall(payload, context);

  if (!decision.allow) {
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: `[factory guard] ${decision.reason}`,
        },
      })
    );
  }

  return ok("", decision);
};
