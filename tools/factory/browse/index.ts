import type { IFactoryCommand } from "../command.types";
import { notBuilt } from "../not-built";

/* Seeing it work: open every route signed in; walk a change with a screenshot per step. */
const stub = (
  name: string,
  summary: string,
  usage?: string
): IFactoryCommand => ({
  name,
  summary,
  usage,
  run: () => Promise.resolve(notBuilt(name)),
});

export const browseCommands: readonly IFactoryCommand[] = [
  stub(
    "browse",
    "Open every app route signed in; fail on script errors or failed API calls"
  ),
  stub(
    "walk",
    "Run a walkthrough scenario with a screenshot per step",
    "<scenario-file>"
  ),
];
