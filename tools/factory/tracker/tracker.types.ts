/*
 * The work-item tracker the factory talks to: GitHub Issues by default,
 * Linear with FACTORY_TRACKER=linear. Adapters only move data; the text
 * they post is built by the *.utils.ts modules.
 */
export type TrackerName = "github" | "linear";

export interface IComment {
  /** The comment's id in the tracker, as the tracker's own API takes it. */
  readonly id: string;
  readonly body: string;
}

export interface IIssue {
  /** The id the factory uses on the command line: "123" (GitHub), "ENG-123" (Linear). */
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly labels: readonly string[];
  readonly url: string;
  readonly comments: readonly IComment[];
}

/** The state a hand-over moves an issue to. */
export type IssueState = "review";

export type UpsertResult = "created" | "updated";

export interface ITracker {
  readonly name: TrackerName;
  issue: (id: string) => Promise<IIssue>;
  /** Edits the one comment whose body holds `marker`, or adds it. */
  upsertComment: (
    issueId: string,
    marker: string,
    body: string
  ) => Promise<UpsertResult>;
  setState: (issueId: string, state: IssueState) => Promise<void>;
}
