import type { IFactoryCommand } from "../command.types";
import { notBuilt } from "../not-built";

/*
 * Workspaces and slots: one git worktree plus one whole compose stack per
 * agent session, with its own ports, preview URL and claim. See README.md.
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

export const workspaceCommands: readonly IFactoryCommand[] = [
  stub(
    "workspace new",
    "Claim a free slot and create a worktree for an issue",
    "<issue-id>"
  ),
  stub("workspace list", "List workspaces and the slots they hold"),
  stub(
    "workspace remove",
    "Remove a workspace (refuses uncommitted or unpushed work)",
    "<name>"
  ),
  stub("up", "Build and start this workspace's stack, wait for health, seed"),
  stub("down", "Stop this workspace's stack", "[-v]"),
  stub(
    "status",
    "Set or show this workspace's plain-language status",
    "[--issue <id>] [--title <text>] [<status line>]"
  ),
  stub("preview", "Print (and register) this workspace's preview URL"),
  stub(
    "doctor",
    "Check the machine and this workspace for what the factory needs"
  ),
  stub("sweep", "Remove stacks whose checkout is gone; trim the build cache"),
  stub(
    "compose-policy",
    "Check compose files against the factory policy (pins, limits, health checks)"
  ),
];
