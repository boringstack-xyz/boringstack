import type { IFactoryCommand } from "../command.types";
import { notBuilt } from "../not-built";

/*
 * Proof: verification runs compared with the base commit, the verification
 * record an agent writes for a branch, and the gate the Stop hook enforces.
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

export const recordCommands: readonly IFactoryCommand[] = [
  stub(
    "verify",
    "Run agent:verify for the apps this branch changed; failures that also fail on the base commit become warnings",
    "[--profile=<p>]"
  ),
  stub(
    "verification new",
    "Write the verification record skeleton for a branch",
    "<branch>"
  ),
  stub(
    "verification check",
    "Check a branch's verification record is complete and current",
    "<branch>"
  ),
  stub(
    "verification gaps",
    "List recent 'Not verified' items across records",
    "[--since <days>]"
  ),
  stub("gate", "Everything the Stop hook requires, run now"),
];
