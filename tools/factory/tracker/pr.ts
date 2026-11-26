import type { IFactoryCommand } from "../command.types";
import type { IFactoryContext } from "../context";
import { FACTORY_CONFIG } from "../factory.config";
import { blocked, failed, ok, type ICommandOutcome } from "../result";
import { readText } from "../state";
import {
  issueOfBranch,
  recordFile,
  recordProblems,
} from "../record/verification";
import { isPushed, newestSubject } from "./branch";
import { readIssue } from "./handover";
import { riskReason } from "./handover.utils";
import { createPr, findOpenPr, updatePr } from "./github.pr";
import { liveDeps, guarded, setupTracker, type ITrackerDeps } from "./select";
import { conventionalTitle, prBody, urlIn } from "./pr.utils";
import { riskOf } from "../record/verification.utils";

const USAGE = "usage: bun run factory pr <branch> [--dry-run]";

/*
 * `factory pr <branch>`: opens the branch's pull request, or updates the one
 * that exists. Draft until its verification record is complete. Never merges: agent-merge.yml
 * decides by risk after the independent review.
 */
export const prWith =
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
          `${branch} is not on GitHub yet, so no pull request can be opened; push it first (git push -u origin ${branch})`
        );
      }

      const { tracker, repo } = setupTracker(context, deps);

      if (repo === undefined) {
        return blocked(
          "pull requests go to GitHub, and this checkout's origin is not a GitHub repository"
        );
      }

      const { issue, note } = await readIssue(tracker, issueId, dryRun);
      const title = conventionalTitle({
        issueTitle: issue?.title ?? "",
        labels: issue?.labels ?? [],
        fallback: newestSubject(context, branch) ?? branch,
      });
      const titleCheck = deps.run(
        "bash",
        ["scripts/ci/check-commit-title.sh", title],
        { cwd: context.root }
      );

      if (titleCheck.status !== 0) {
        return failed(
          `the pull request title does not pass the commit-title check: ${titleCheck.stderr.trim()}`
        );
      }

      const record = readText(recordFile(context, branch)) ?? "";
      const problems = recordProblems(context, branch);
      const draft = problems.length > 0;
      const reference =
        tracker.name === "github"
          ? `Closes #${issueId}`
          : `Linear: ${issue?.url ?? issueId}`;
      const risk = riskOf(record);
      const body = prBody({
        risk,
        reason: riskReason(record),
        reference,
        record,
        problems,
      });
      const existing = findOpenPr(deps.run, repo, branch);
      const base = FACTORY_CONFIG.protectedBranches[0];

      if (dryRun) {
        return ok(
          [
            `[dry run] nothing opened or changed. ${existing === undefined ? `It would open a pull request into ${base}` : `It would update ${existing.url}`}.`,
            ...(note === undefined ? [] : [`[dry run] ${note}`]),
            `Title: ${title}`,
            `Draft: ${draft ? `yes (${problems.join("; ")})` : "no, the record is complete"}`,
            "",
            body,
          ].join("\n"),
          { title, draft, body, existing: existing?.url }
        );
      }

      if (existing !== undefined) {
        updatePr(deps.run, {
          repo,
          pr: existing,
          title,
          body,
          draft,
          cwd: context.root,
        });

        return ok(
          `updated pull request ${existing.url}${draft ? " (draft)" : ""}`,
          { url: existing.url, draft }
        );
      }

      const created = createPr(deps.run, {
        repo,
        base,
        head: branch,
        title,
        body,
        draft,
        cwd: context.root,
      });
      const url = urlIn(created) ?? created;

      return ok(`opened pull request ${url}${draft ? " as a draft" : ""}`, {
        url,
        draft,
      });
    });

export const prCommand: IFactoryCommand = {
  name: "pr",
  summary:
    "Open the pull request for a branch (draft until its record is complete)",
  usage: "<branch> [--dry-run]",
  run: prWith(liveDeps),
};
