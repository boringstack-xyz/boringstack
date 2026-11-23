import type { IFactoryContext } from "./context";
import type { ICommandOutcome } from "./result";

/** One `bun run factory <name> [args]` command. */
export interface IFactoryCommand {
  /** Space-separated words, matched against the start of argv: "workspace new". */
  readonly name: string;
  /** One line for `factory help`. */
  readonly summary: string;
  /** Argument synopsis, e.g. "<issue-id> [--json]". */
  readonly usage?: string;
  readonly run: (
    args: readonly string[],
    context: IFactoryContext
  ) => Promise<ICommandOutcome>;
}
