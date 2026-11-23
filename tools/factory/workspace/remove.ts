import type { IFactoryCommand } from "../command.types";
import { blocked, failed, ok } from "../result";
import { parseArgs, isParseError } from "./args.utils";
import { runSlotCompose } from "./compose";
import { readClaim, heldSlots, releaseClaim } from "./claims";
import { stateDirOf, workspacePathOf } from "./paths";
import { isSafeIssueId } from "./paths.utils";
import { dropPreview } from "./preview-routes";
import { runtimeOf } from "./runtime";
import { removeRecord } from "./records";
import { removeWorktree, workReportOf, worktreePaths } from "./worktree";
import { describeWork, isSafeToDiscard } from "./worktree.utils";

export const removeWorkspace: IFactoryCommand = {
  name: "workspace remove",
  summary: "Remove a workspace (refuses uncommitted or unpushed work)",
  usage: "<name> [--force]",
  run: (args, context) => {
    const parsed = parseArgs(args, [], ["--force"]);

    if (isParseError(parsed) || parsed.rest.length !== 1) {
      return Promise.resolve(
        failed(
          isParseError(parsed)
            ? parsed.error
            : "give one workspace name, for example demo-1"
        )
      );
    }

    const name = parsed.rest[0] ?? "";
    const runtime = runtimeOf(context);
    const path = workspacePathOf(runtime.main, name);

    if (!isSafeIssueId(name) || !worktreePaths(runtime.main).includes(path)) {
      return Promise.resolve(
        failed(
          `there is no workspace named ${name} (workspace list shows them)`
        )
      );
    }

    const force = parsed.switches.has("--force");
    const report = workReportOf(path);

    if (!force && !isSafeToDiscard(report)) {
      return Promise.resolve(
        blocked(
          `refusing to remove ${name}: ${describeWork(report)}. Commit and push first, or pass --force`,
          { report }
        )
      );
    }

    const claim = heldSlots(runtime.shared)
      .map((slot) => readClaim(runtime.shared, slot))
      .find((held) => held?.workspace === path);

    // The stack goes first: if it cannot be removed, the workspace and its slot stay.
    if (claim !== undefined) {
      const stopped = runSlotCompose(
        path,
        stateDirOf(path),
        claim.slot,
        ["down", "--remove-orphans", "-v"],
        undefined,
        300_000
      );

      if (stopped.error !== undefined || stopped.code !== 0) {
        return Promise.resolve(
          blocked(
            `could not remove slot ${String(claim.slot)}'s stack; is Docker running? The workspace was kept`
          )
        );
      }

      dropPreview(runtime.workspace, runtime.shared, claim.slot);
      removeRecord(runtime.shared, "status", claim.slot);
    }

    const removed = removeWorktree(runtime.main, path, force);

    if (!removed.ok) {
      return Promise.resolve(
        failed(
          `git could not remove the workspace: ${removed.err === "" ? "unknown error" : removed.err}`
        )
      );
    }

    if (claim !== undefined) {
      releaseClaim(runtime.shared, claim.slot);
    }

    return Promise.resolve(
      ok(
        `removed workspace ${name}${claim === undefined ? "" : ` and freed slot ${String(claim.slot)}`}`,
        { name, path }
      )
    );
  },
};
