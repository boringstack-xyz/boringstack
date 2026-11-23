import type { IFactoryCommand } from "../command.types";
import { blocked, failed, ok } from "../result";
import { runSlotCompose } from "./compose";
import { dropPreview } from "./preview-routes";
import { stateDirOf } from "./paths";
import { parseArgs, isParseError } from "./args.utils";
import { runtimeOf, slotOfCheckout } from "./runtime";
import { describeWork, isSafeToDiscard } from "./worktree.utils";
import { workReportOf } from "./worktree";

export const downStack: IFactoryCommand = {
  name: "down",
  summary: "Stop this workspace's stack",
  usage: "[-v] [--force]",
  run: (args, context) => {
    const parsed = parseArgs(args, [], ["-v", "--force"]);

    if (isParseError(parsed) || parsed.rest.length > 0) {
      return Promise.resolve(
        failed(
          isParseError(parsed)
            ? parsed.error
            : "down takes no words, only -v and --force"
        )
      );
    }

    const runtime = runtimeOf(context);
    const claim = slotOfCheckout(runtime.workspace);

    if (claim === undefined) {
      return Promise.resolve(
        blocked("this checkout holds no slot, so there is no stack to stop")
      );
    }

    const removeData = parsed.switches.has("-v");

    // -v deletes the stack's database and volumes: refuse while work is unsaved.
    if (removeData && !parsed.switches.has("--force")) {
      const report = workReportOf(runtime.workspace);

      if (!isSafeToDiscard(report)) {
        return Promise.resolve(
          blocked(
            `refusing to delete this stack's data: ${describeWork(report)}. Commit and push first, or run down -v --force`,
            { report }
          )
        );
      }
    }

    const run = runSlotCompose(
      runtime.workspace,
      stateDirOf(runtime.workspace),
      claim.slot,
      ["down", "--remove-orphans", ...(removeData ? ["-v"] : [])],
      undefined,
      300_000
    );

    if (run.error !== undefined || run.code !== 0) {
      return Promise.resolve(
        blocked("the stack did not stop cleanly; is Docker running?")
      );
    }

    dropPreview(runtime.workspace, runtime.shared, claim.slot);

    return Promise.resolve(
      ok(
        `slot ${String(claim.slot)} stopped${removeData ? "; its data is deleted" : ""}`,
        { slot: claim.slot, removeData }
      )
    );
  },
};
