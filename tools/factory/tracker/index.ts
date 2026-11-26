import type { IFactoryCommand } from "../command.types";
import { handoverCommand } from "./handover";
import { issueCommand } from "./issue";
import { prCommand } from "./pr";

/*
 * Work items and hand-over: GitHub Issues by default, Linear with
 * FACTORY_TRACKER=linear. Pull requests always go to GitHub; who merges goes by risk (../risk/risk.ts).
 */
export const trackerCommands: readonly IFactoryCommand[] = [
  issueCommand,
  handoverCommand,
  prCommand,
];
