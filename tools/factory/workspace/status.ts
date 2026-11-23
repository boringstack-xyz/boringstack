import type { IFactoryCommand } from "../command.types";
import { nowIso } from "../clock";
import { blocked, failed, ok } from "../result";
import { parseArgs, isParseError } from "./args.utils";
import { readRecord, writeRecord } from "./records";
import { plainProblems, refusal } from "./status.utils";
import { runtimeOf, slotOfCheckout } from "./runtime";

/**
 * `status [--issue <id>] [--title <text>] [<line>]`: with nothing to set, prints
 * this slot's status; otherwise checks each text in plain words and saves it.
 */
export const statusCommand: IFactoryCommand = {
  name: "status",
  summary: "Set or show this workspace's plain-language status",
  usage: "[--issue <id>] [--title <text>] [<status line>]",
  run: (args, context) => {
    const parsed = parseArgs(args, ["--issue", "--title"], []);

    if (isParseError(parsed)) {
      return Promise.resolve(failed(parsed.error));
    }

    const runtime = runtimeOf(context);
    const claim = slotOfCheckout(runtime.workspace);

    if (claim === undefined) {
      return Promise.resolve(
        blocked(
          "this checkout holds no slot; start one with: bun run factory workspace new <issue-id>"
        )
      );
    }

    const line = parsed.rest.join(" ");
    const title = parsed.values["--title"];
    const issue = parsed.values["--issue"];
    const current = readRecord(runtime.shared, "status", claim.slot) ?? {};
    const setsAnything =
      line !== "" || title !== undefined || issue !== undefined;

    if (!setsAnything) {
      const text =
        typeof current.status === "string" ? current.status : "no status yet";

      return Promise.resolve(
        ok(`slot ${String(claim.slot)} (${claim.issue}): ${text}`, current)
      );
    }

    for (const [kind, text] of [
      ["status", line],
      ["title", title],
    ] as const) {
      if (text === undefined || (kind === "status" && line === "")) {
        continue;
      }

      const problems = plainProblems(text);

      if (problems.length > 0) {
        return Promise.resolve(failed(refusal(kind, problems)));
      }
    }

    const next = {
      ...current,
      slot: claim.slot,
      issue: issue ?? claim.issue,
      workspace: runtime.workspace,
      ...(title === undefined ? {} : { title }),
      ...(line === "" ? {} : { status: line }),
      updatedAt: nowIso(),
    };

    writeRecord(runtime.shared, "status", claim.slot, next);

    return Promise.resolve(
      ok(
        `slot ${String(claim.slot)} (${next.issue}): ${typeof next.status === "string" ? next.status : "status saved"}`,
        next
      )
    );
  },
};
