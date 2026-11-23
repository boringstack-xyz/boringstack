import type { IFactoryCommand } from "../command.types";
import { findingsCommand } from "./findings";
import { fleetServe, fleetStatus } from "./fleet";
import { logsCommand } from "./logs";

/* Every stack on the machine, its health and what it is doing; the error logs and ledger. */
export const fleetCommands: readonly IFactoryCommand[] = [
  {
    name: "fleet",
    summary: "Every factory stack on this machine as a table",
    usage: "[--json]",
    run: (_args, context) => Promise.resolve(fleetStatus(context)),
  },
  {
    name: "fleet serve",
    summary: "Serve the self-refreshing fleet page on 127.0.0.1",
    run: (_args, context) => Promise.resolve(fleetServe(context)),
  },
  {
    name: "logs",
    summary: "Logs across this workspace's stack, or one with --slot",
    usage:
      "[--errors] [--since <dur>] [--request <id>] [--summary] [--slot <N>]",
    run: (args, context) => Promise.resolve(logsCommand(args, context)),
  },
  {
    name: "findings",
    summary:
      "Group recent errors across every stack into a ledger; file new ones",
    usage: "[--since <dur>] [--file]",
    run: findingsCommand,
  },
];
