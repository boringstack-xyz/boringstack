import type { IFactoryCommand } from "../command.types";
import { notBuilt } from "../not-built";

/* Every stack on the machine, its health and what it is doing; the error ledger. */
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

export const fleetCommands: readonly IFactoryCommand[] = [
  stub("fleet", "Every factory stack on this machine as a table", "[--json]"),
  stub("fleet serve", "Serve the self-refreshing fleet page"),
  stub(
    "logs",
    "Logs across this workspace's containers",
    "[--errors] [--since <dur>] [--request <id>]"
  ),
  stub(
    "findings",
    "Group recent errors into a ledger; file new ones as issues",
    "[--file]"
  ),
];
