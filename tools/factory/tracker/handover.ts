import type { IFactoryCommand } from "../command.types";
import type { IFactoryContext } from "../context";
import { blocked, failed, ok, type ICommandOutcome } from "../result";
import { readText } from "../state";
import {
  issueOfBranch,
  recordFile,
  recordProblems,
} from "../record/verification";
import { isPushed, newestSubject } from "./branch";
import { handoverCard } from "./handover.utils";
import { previewOf } from "./preview";
import { guarded, liveDeps, setupTracker, type ITrackerDeps } from "./select";
import type { IIssue, ITracker } from "./tracker.types";
import { HANDOVER_MARKER, planUpsert, withMarker } from "./tracker.utils";

const USAGE = "usage: bun run factory handover <branch> [--dry-run]";

/**
 * The issue for the card. A dry run keeps going without it (the title falls
 * back to the branch's newest commit) so the card can still be shown.
 */
export const readIssue = async (
  tracker: ITracker,
  issueId: string,
  dryRun: boolean
): Promise<{ issue: IIssue | undefined; note: string | undefined }> => {
  try {
    return { issue: await tracker.issue(issueId), note: undefined };
  } catch (error) {
    if (!dryRun) {
      throw error;
    }

    return {
      issue: undefined,
      note: `could not read issue ${issueId} (${error instanceof Error ? error.message : String(error)})`,
    };
  }
};

/*
 * `factory handover <branch>`: one hand-over card on the branch's issue,
 * edited in place, and the issue moved to review. Refuses (blocked) while the
 * branch is not on GitHub or its verification record is incomplete.
 */
export const handoverWith =
  (deps: ITrackerDeps) =>
  (
    args: readonly string[],
    context: IFactoryContext
  ): Promise<ICommandOutcome> =>
    guarded(async () => {
      const dryRun = args.includes("--dry-run");
      const branch = args.find((arg) => !arg.startsWith("-"));

      if (branch === undefined) {
        return failed(USAGE);
      }

      const issueId = issueOfBranch(branch);

      if (issueId === undefined) {
        return failed(`${branch} is not a factory branch (factory/<issue>)`);
      }

      if (!isPushed(context, branch)) {
        return blocked(
          `${branch} is not on GitHub yet, so the card cannot point at it; push it first (git push -u origin ${branch})`
        );
      }

      const problems = recordProblems(context, branch);

      if (problems.length > 0) {
        return blocked(
          [
            `the verification record of ${branch} is not complete:`,
            ...problems.map((problem) => `- ${problem}`),
          ].join("\n"),
          { problems }
        );
      }

      const { tracker } = setupTracker(context, deps);
      const { issue, note } = await readIssue(tracker, issueId, dryRun);
      const title = issue?.title ?? newestSubject(context, branch) ?? branch;
      const body = withMarker(
        handoverCard({
          title,
          branch,
          preview: previewOf(context),
          record: readText(recordFile(context, branch)) ?? "",
        }),
        HANDOVER_MARKER
      );

      if (dryRun) {
        const existing =
          issue === undefined
            ? "post the card (whether one is already there is unknown, the issue could not be read)"
            : planUpsert(issue.comments, HANDOVER_MARKER).action === "update"
              ? "edit the card already on the issue"
              : "add a new card";

        return ok(
          [
            `[dry run] nothing posted. On issue ${issueId} it would ${existing}, then move the issue to review.`,
            ...(note === undefined ? [] : [`[dry run] ${note}`]),
            "",
            body,
          ].join("\n"),
          { issueId, branch, body }
        );
      }

      const result = await tracker.upsertComment(
        issueId,
        HANDOVER_MARKER,
        body
      );

      await tracker.setState(issueId, "review");

      return ok(
        `hand-over card ${result} on issue ${issueId}; it is in review`,
        {
          issueId,
          branch,
          result,
        }
      );
    });

export const handoverCommand: IFactoryCommand = {
  name: "handover",
  summary: "Post or update the hand-over card for a branch's issue",
  usage: "<branch> [--dry-run]",
  run: handoverWith(liveDeps),
};
