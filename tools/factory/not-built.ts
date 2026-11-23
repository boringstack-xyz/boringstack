import { blocked, type ICommandOutcome } from "./result";

/** A command whose module has not been built yet: blocked, never a silent pass. */
export const notBuilt = (command: string): ICommandOutcome =>
  blocked(`factory ${command} is not built yet`, {
    reason: "not_built",
    command,
  });
