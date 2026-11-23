import type { IFactoryContext } from "../context";
import { git } from "../git";
import { blocked, failed, type ICommandOutcome } from "../result";
import { createGitHubTracker } from "./github";
import { type IHttp, createLinearTracker } from "./linear";
import { type IProcessRunner, runProcess } from "./process";
import type { ITracker } from "./tracker.types";
import { repoSlugOf } from "./tracker.utils";

/* What the tracker commands talk through; tests pass fakes. */
export interface ITrackerDeps {
  readonly run: IProcessRunner;
  readonly http: IHttp;
}

export const liveDeps: ITrackerDeps = {
  run: runProcess,
  http: (url, init) => fetch(url, init),
};

export interface ITrackerSetup {
  readonly tracker: ITracker;
  /** owner/name of the checkout's GitHub origin; pull requests always go there. */
  readonly repo: string | undefined;
}

/** Raised when a command cannot reach its tracker; carries the outcome to print. */
export class TrackerStop extends Error {
  readonly outcome: ICommandOutcome;

  constructor(outcome: ICommandOutcome) {
    super(outcome.summary);
    this.outcome = outcome;
  }
}

/** The tracker FACTORY_TRACKER names (GitHub by default). */
export const setupTracker = (
  context: IFactoryContext,
  deps: ITrackerDeps
): ITrackerSetup => {
  const repo = repoSlugOf(git(context.root, ["remote", "get-url", "origin"]));
  const name = context.env.tracker ?? "github";

  if (name === "linear") {
    const key = context.env.linearApiKey;

    if (key === undefined || key === "") {
      throw new TrackerStop(
        blocked(
          "FACTORY_TRACKER is linear, but LINEAR_API_KEY is not set; a person must add it"
        )
      );
    }

    return { tracker: createLinearTracker(key, deps.http), repo };
  }

  if (name !== "github") {
    throw new TrackerStop(
      failed(`FACTORY_TRACKER must be github or linear, not ${name}`)
    );
  }

  if (repo === undefined) {
    throw new TrackerStop(
      blocked("this checkout's origin is not a GitHub repository")
    );
  }

  return { tracker: createGitHubTracker(repo, deps.run), repo };
};

/** Runs a command body; a tracker failure becomes a plain failed outcome. */
export const guarded = async (
  body: () => Promise<ICommandOutcome>
): Promise<ICommandOutcome> => {
  try {
    return await body();
  } catch (error) {
    if (error instanceof TrackerStop) {
      return error.outcome;
    }

    return failed(error instanceof Error ? error.message : String(error));
  }
};
