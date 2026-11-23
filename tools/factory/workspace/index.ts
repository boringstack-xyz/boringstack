import type { IFactoryCommand } from "../command.types";
import { composePolicyCommand } from "./policy";
import { doctorCommand } from "./doctor";
import { downStack } from "./down";
import { listWorkspaces } from "./list";
import { newWorkspace } from "./new";
import { previewCommand } from "./preview";
import { removeWorkspace } from "./remove";
import { statusCommand } from "./status";
import { sweepCommand } from "./sweep";
import { upStack } from "./up";

/*
 * Workspaces and slots: one git worktree plus one whole compose stack per
 * agent session, with its own ports, preview URL and claim. See README.md.
 */
export const workspaceCommands: readonly IFactoryCommand[] = [
  newWorkspace,
  listWorkspaces,
  removeWorkspace,
  upStack,
  downStack,
  statusCommand,
  previewCommand,
  doctorCommand,
  sweepCommand,
  composePolicyCommand,
];
