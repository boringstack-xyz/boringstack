import { type IProcessRunner, mustSucceed } from "./process";
import type {
  IComment,
  IIssue,
  IssueState,
  ITracker,
  UpsertResult,
} from "./tracker.types";
import { GITHUB_STATE_LABELS, planUpsert } from "./tracker.utils";

/* GitHub Issues through the gh CLI. `repo` is owner/name. */
interface IGhIssue {
  readonly title: string;
  readonly body: string;
  readonly url: string;
  readonly labels: readonly string[];
  readonly comments: readonly IComment[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const textOf = (value: unknown): string =>
  typeof value === "string" ? value : "";

/** What `gh issue view --json` prints, with the fields the factory reads. */
const parseIssue = (text: string): IGhIssue => {
  const parsed: unknown = JSON.parse(text);

  if (!isRecord(parsed) || typeof parsed.title !== "string") {
    throw new Error("gh returned no issue");
  }

  const labels: unknown[] = Array.isArray(parsed.labels) ? parsed.labels : [];
  const comments: unknown[] = Array.isArray(parsed.comments)
    ? parsed.comments
    : [];

  return {
    title: parsed.title,
    body: textOf(parsed.body),
    url: textOf(parsed.url),
    labels: labels.flatMap((label) =>
      isRecord(label) ? [textOf(label.name)] : []
    ),
    comments: comments.flatMap((comment) =>
      isRecord(comment)
        ? [{ id: textOf(comment.id), body: textOf(comment.body) }]
        : []
    ),
  };
};

/** Runs `work` and settles with its value or its error, so a throw is a rejection. */
const settle = <T>(work: () => T): Promise<T> =>
  new Promise<T>((resolve) => {
    resolve(work());
  });

export const createGitHubTracker = (
  repo: string,
  run: IProcessRunner
): ITracker => {
  const view = (id: string): IGhIssue =>
    parseIssue(
      mustSucceed(
        `reading issue ${id}`,
        run("gh", [
          "issue",
          "view",
          id,
          "--repo",
          repo,
          "--json",
          "number,title,body,labels,url,comments",
        ])
      ).stdout
    );

  return {
    name: "github",
    issue: (id) =>
      settle((): IIssue => {
        const issue = view(id);

        return {
          id,
          title: issue.title,
          body: issue.body,
          labels: issue.labels,
          url: issue.url,
          comments: issue.comments,
        };
      }),
    upsertComment: (issueId, marker, body) =>
      settle((): UpsertResult => {
        const plan = planUpsert(view(issueId).comments, marker);

        if (plan.action === "create") {
          mustSucceed(
            `adding the card to issue ${issueId}`,
            run("gh", [
              "issue",
              "comment",
              issueId,
              "--repo",
              repo,
              "--body",
              body,
            ])
          );

          return "created";
        }

        // Edited by node id, the id `gh issue view` returns for each comment.
        mustSucceed(
          `editing the card on issue ${issueId}`,
          run("gh", [
            "api",
            "graphql",
            "-f",
            "query=mutation($id: ID!, $body: String!) { updateIssueComment(input: {id: $id, body: $body}) { issueComment { id } } }",
            "-f",
            `id=${plan.id}`,
            "-f",
            `body=${body}`,
          ])
        );

        return "updated";
      }),
    setState: (issueId: string, state: IssueState) =>
      settle((): void => {
        const labels = GITHUB_STATE_LABELS[state];

        mustSucceed(
          `creating label ${labels.add}`,
          run("gh", ["label", "create", labels.add, "--repo", repo, "--force"])
        );
        mustSucceed(
          `moving issue ${issueId} to ${state}`,
          run("gh", [
            "issue",
            "edit",
            issueId,
            "--repo",
            repo,
            "--add-label",
            labels.add,
            ...labels.remove.flatMap((label) => ["--remove-label", label]),
          ])
        );
      }),
  };
};
