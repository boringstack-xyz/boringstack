import type { IFactoryCommand } from "../command.types";
import { browseRun } from "./browse";
import { walkRun } from "./walk";

/* Seeing it work: open every route signed in; walk a change with a screenshot per step. */
export const browseCommands: readonly IFactoryCommand[] = [
  {
    name: "browse",
    summary:
      "Open every app route signed in; fail on script errors or failed API calls",
    usage: "[--base-url <url>]",
    run: (args, context) => browseRun(args, context),
  },
  {
    name: "walk",
    summary: "Run a walkthrough scenario with a screenshot per step",
    usage: "<scenario-file> [--base-url <url>]",
    run: (args, context) => walkRun(args, context),
  },
];
