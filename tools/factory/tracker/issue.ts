import type { IFactoryCommand } from "../command.types";
import type { IFactoryContext } from "../context";
import { failed, ok, type ICommandOutcome } from "../result";
import { acceptanceCriteria, issueText } from "./issue.utils";
import { guarded, liveDeps, setupTracker, type ITrackerDeps } from "./select";

/* `factory issue <id>`: read-only. Prints the issue a person or a build reads. */
export const issueWith =
  (deps: ITrackerDeps) =>
  (
    args: readonly string[],
    context: IFactoryContext
  ): Promise<ICommandOutcome> =>
    guarded(async () => {
      const id = args.find((arg) => !arg.startsWith("-"));

      if (id === undefined) {
        return failed("usage: bun run factory issue <id>");
      }

      const { tracker } = setupTracker(context, deps);
      const issue = await tracker.issue(id);
      const criteria = acceptanceCriteria(issue.body);

      return ok(issueText(issue, criteria), {
        id: issue.id,
        title: issue.title,
        url: issue.url,
        labels: issue.labels,
        criteria,
        body: issue.body,
      });
    });

export const issueCommand: IFactoryCommand = {
  name: "issue",
  summary: "Show an issue with its acceptance criteria",
  usage: "<id>",
  run: issueWith(liveDeps),
};
