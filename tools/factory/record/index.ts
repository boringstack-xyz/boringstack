import type { IFactoryCommand } from "../command.types";
import { gateCommand } from "./gate";
import {
  verificationCheck,
  verificationGaps,
  verificationNew,
} from "./verification";
import { verifyCommand } from "./verify";

/*
 * Proof: verification runs compared with the base commit, the verification
 * record an agent writes for a branch, and the gate the Stop hook enforces.
 */
export const recordCommands: readonly IFactoryCommand[] = [
  {
    name: "verify",
    summary:
      "Run the checks for every unit this branch changed; failures that also fail on the base commit become warnings",
    usage: "[--units=apps/api,apps/ui] [--no-base]",
    run: verifyCommand,
  },
  {
    name: "verification new",
    summary: "Write the verification record skeleton for a branch",
    usage: "[<branch>] [--force]",
    run: verificationNew,
  },
  {
    name: "verification check",
    summary: "Check a branch's verification record is complete and current",
    usage: "[<branch>]",
    run: verificationCheck,
  },
  {
    name: "verification gaps",
    summary: "List recent 'Not verified' items across records",
    usage: "[--since <days>]",
    run: verificationGaps,
  },
  {
    name: "gate",
    summary:
      "Verify what this session changed (what the Stop hook requires); run it in the background",
    usage: "[--session <id>]",
    run: gateCommand,
  },
];
