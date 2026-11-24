import type { IFactoryCommand } from "../command.types";
import { remoteCommand } from "./remote";

/* Read-only: the remote-agent routes for this checkout and what each one still needs. */
export const remoteCommands: readonly IFactoryCommand[] = [
  {
    name: "remote",
    summary:
      "How to run agents in the cloud and steer them from a phone, and what this checkout still lacks",
    usage: "[--json]",
    run: (_args, context) => Promise.resolve(remoteCommand(context)),
  },
];
