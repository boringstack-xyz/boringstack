import type { IFactoryCommand } from "../command.types";
import { notBuilt } from "../not-built";

/*
 * Work items and hand-over: GitHub Issues by default, Linear with
 * FACTORY_TRACKER=linear. Agents never merge.
 */
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

export const trackerCommands: readonly IFactoryCommand[] = [
  stub("issue", "Show an issue with its acceptance criteria", "<id>"),
  stub(
    "handover",
    "Post or update the hand-over card for a branch's issue",
    "<branch>"
  ),
  stub(
    "pr",
    "Open the pull request for a branch (draft until its record is complete)",
    "<branch>"
  ),
];
