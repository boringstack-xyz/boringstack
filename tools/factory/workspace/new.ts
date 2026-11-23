import { existsSync, mkdirSync } from "node:fs";

import type { IFactoryCommand } from "../command.types";
import { blocked, failed, ok } from "../result";
import { runtimeOf, writeSlotOfCheckout } from "./runtime";
import {
  claimFirstFreeSlot,
  heldSlots,
  readClaim,
  releaseClaim,
} from "./claims";
import { workspacePathOf, workspacesDirOf } from "./paths";
import { isSafeIssueId, branchFor, slotPorts } from "./paths.utils";
import { addWorktree, baseExists, fetchBase } from "./worktree";
import { directUrlOf } from "./preview.utils";
import { prepareCheckout } from "./prepare";
import { parseArgs, isParseError } from "./args.utils";

const BASE = "origin/main";

export const newWorkspace: IFactoryCommand = {
  name: "workspace new",
  summary: "Claim a free slot and create a worktree for an issue",
  usage: "<issue-id> [--base <ref>]",
  run: (args, context) => {
    const parsed = parseArgs(args, ["--base"], []);

    if (isParseError(parsed) || parsed.rest.length !== 1) {
      return Promise.resolve(
        failed(
          isParseError(parsed)
            ? parsed.error
            : "give one issue id: letters, digits, dots, dashes or underscores (for example demo-1)"
        )
      );
    }

    const issue = parsed.rest[0] ?? "";
    const base = parsed.values["--base"] ?? BASE;

    if (!isSafeIssueId(issue)) {
      return Promise.resolve(
        failed(
          "the issue id may use letters, digits, dots, dashes and underscores only"
        )
      );
    }

    const runtime = runtimeOf(context);
    const path = workspacePathOf(runtime.main, issue);

    if (existsSync(path)) {
      return Promise.resolve(
        blocked(`a workspace for ${issue} already exists at ${path}`)
      );
    }

    const sameIssue = heldSlots(runtime.shared)
      .map((slot) => readClaim(runtime.shared, slot))
      .find((claim) => claim?.issue === issue);

    if (sameIssue !== undefined) {
      return Promise.resolve(
        blocked(
          `issue ${issue} already holds slot ${String(sameIssue.slot)} at ${sameIssue.workspace}`
        )
      );
    }

    mkdirSync(workspacesDirOf(runtime.main), { recursive: true });
    /*
     * Only the default base is refreshed from the remote; --base names a ref
     * as it is (a branch under test, for example).
     */
    const fetched = base === BASE ? fetchBase(runtime.main) : false;

    if (!baseExists(runtime.main, base)) {
      return Promise.resolve(
        blocked(
          `there is no ${base} to start from; fetch it (git fetch origin main) and run again`
        )
      );
    }

    const branch = branchFor(issue);
    const claim = claimFirstFreeSlot(runtime.shared, {
      workspace: path,
      issue,
      branch,
    });

    if (claim === undefined) {
      return Promise.resolve(
        blocked(
          "every slot is in use; remove a workspace you no longer need (workspace list)"
        )
      );
    }

    const added = addWorktree(runtime.main, path, branch, base);

    if (!added.ok) {
      releaseClaim(runtime.shared, claim.slot);

      return Promise.resolve(
        failed(
          `could not create the workspace: ${added.err === "" ? "git refused" : added.err}`
        )
      );
    }

    writeSlotOfCheckout(path, claim);
    prepareCheckout(path);
    const ports = slotPorts(claim.slot);
    const lines = [
      `workspace ${issue} is slot ${String(claim.slot)} at ${path}`,
      `branch ${branch}, started from ${base}${base === BASE && !fetched ? " (not refreshed: offline)" : ""}`,
      `UI ${directUrlOf(claim.slot)}  API http://127.0.0.1:${String(ports.api)}`,
      "next: bun run factory up",
    ];

    return Promise.resolve(ok(lines.join("\n"), { ...claim, ports }));
  },
};
