import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

import type { IFactoryCommand } from "../command.types";
import { FACTORY_CONFIG } from "../factory.config";
import { blocked, failed, ok } from "../result";
import { readClaim, heldSlots, releaseClaim } from "./claims";
import { dockerUp } from "./compose";
import { parseArgs, isParseError } from "./args.utils";
import { isSlot, stackProject } from "./paths.utils";
import { dropPreview } from "./preview-routes";
import { removeRecord } from "./records";
import { runtimeOf } from "./runtime";
import { decideSweep, type ISlotState, type SweepAction } from "./sweep.utils";

/** Each container's working folder, for the stack's compose project. */
const stackFoldersOf = (project: string): string[] | undefined => {
  const run = spawnSync(
    "docker",
    [
      "ps",
      "-a",
      "--filter",
      `label=com.docker.compose.project=${project}`,
      "--format",
      '{{.Label "com.docker.compose.project.working_dir"}}',
    ],
    { encoding: "utf8", timeout: 60_000 }
  );

  if (run.status !== 0) {
    return undefined;
  }

  const text = run.stdout.trim();

  return text === "" ? [] : text.split("\n").map((line) => line.trim());
};

/** Removes one slot's stack (only its own project), claim and records. */
const removeSlot = (
  root: string,
  shared: string,
  action: SweepAction
): boolean => {
  const project = stackProject(action.slot);
  const down = spawnSync(
    "docker",
    ["compose", "-p", project, "down", "-v", "--remove-orphans"],
    { cwd: shared, encoding: "utf8", timeout: 300_000 }
  );

  if (down.status !== 0 && down.stderr.trim() !== "") {
    return false;
  }

  releaseClaim(shared, action.slot);
  removeRecord(shared, "status", action.slot);
  dropPreview(root, shared, action.slot);

  return true;
};

export const sweepCommand: IFactoryCommand = {
  name: "sweep",
  summary: "Remove stacks whose checkout is gone; trim the build cache",
  usage: "[--dry-run]",
  run: (args, context) => {
    const parsed = parseArgs(args, [], ["--dry-run"]);

    if (isParseError(parsed) || parsed.rest.length > 0) {
      return Promise.resolve(
        failed(
          isParseError(parsed) ? parsed.error : "sweep takes only --dry-run"
        )
      );
    }

    const dryRun = parsed.switches.has("--dry-run");
    const runtime = runtimeOf(context);
    const held = new Set(heldSlots(runtime.shared));
    const slots: ISlotState[] = [];

    if (!dockerUp()) {
      return Promise.resolve(
        blocked(
          "Docker is not running, so sweep cannot see the stacks; start Docker and run sweep again"
        )
      );
    }

    for (let slot = 1; slot <= FACTORY_CONFIG.maxSlots; slot += 1) {
      if (!isSlot(slot)) {
        continue;
      }

      const folders = stackFoldersOf(stackProject(slot));
      const claim = held.has(slot)
        ? readClaim(runtime.shared, slot)
        : undefined;

      if (folders === undefined) {
        return Promise.resolve(
          blocked(
            `could not list the containers of slot ${String(slot)}; sweep stopped and removed nothing`
          )
        );
      }

      slots.push({
        slot,
        // A claim that cannot be read is kept: it may belong to a folder still in use.
        claimed: held.has(slot),
        workspaceExists:
          claim === undefined ? true : existsSync(claim.workspace),
        stackExists: folders.length > 0,
        stackFoldersExist: folders.map(
          (folder) => folder === "" || existsSync(folder)
        ),
      });
    }

    const actions = decideSweep(slots);
    const removals = actions.filter((action) => action.kind === "remove");
    const lines: string[] = [];

    for (const action of removals) {
      if (dryRun) {
        lines.push(
          `would remove ${stackProject(action.slot)} and its claim (${action.reason})`
        );
        continue;
      }

      const done = removeSlot(runtime.workspace, runtime.shared, action);

      lines.push(
        done
          ? `removed ${stackProject(action.slot)} and its claim (${action.reason})`
          : `could not remove ${stackProject(action.slot)}; run: docker compose -p ${stackProject(action.slot)} down -v`
      );
    }

    if (removals.length === 0) {
      lines.push("nothing to remove");
    }

    const failedRemovals = lines.filter((line) => line.startsWith("could not"));

    return failedRemovals.length > 0
      ? Promise.resolve(failed(lines.join("\n"), { actions }))
      : Promise.resolve(ok(lines.join("\n"), { actions, dryRun }));
  },
};
