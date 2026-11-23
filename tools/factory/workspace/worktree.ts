import { gitRun } from "./paths";
import {
  parseCount,
  uncommittedCount,
  type IWorkReport,
} from "./worktree.utils";

/** Creates a worktree on a new branch from `base` (default origin/main). */
export const addWorktree = (
  main: string,
  path: string,
  branch: string,
  base: string
): { ok: boolean; err: string } => {
  const run = gitRun(main, ["worktree", "add", "-b", branch, path, base]);

  return { ok: run.ok, err: run.err };
};

/**
 * Removes a worktree. Without force git refuses if it holds untracked files
 * or changed tracked files; force is only passed after the caller's own check.
 */
export const removeWorktree = (
  main: string,
  path: string,
  force: boolean
): { ok: boolean; err: string } => {
  const run = gitRun(main, [
    "worktree",
    "remove",
    ...(force ? ["--force"] : []),
    path,
  ]);

  return { ok: run.ok, err: run.err };
};

/** Fetches origin/main; false when the network or remote is unavailable. */
export const fetchBase = (main: string): boolean =>
  gitRun(main, ["fetch", "--quiet", "origin", "main"], 60_000).ok;

export const baseExists = (main: string, base: string): boolean =>
  gitRun(main, ["rev-parse", "--verify", "--quiet", base]).ok;

/** What a checkout still holds: uncommitted files and commits no remote has. */
export const workReportOf = (path: string): IWorkReport => {
  const status = gitRun(path, ["status", "--porcelain"]);
  const unpushed = gitRun(path, [
    "rev-list",
    "--count",
    "HEAD",
    "--not",
    "--remotes",
  ]);
  const count = parseCount(unpushed.out);

  return {
    uncommitted: status.ok ? uncommittedCount(status.out) : 0,
    unpushed: count ?? 0,
    unknown: !status.ok || count === undefined,
  };
};

/** The worktree list git knows, as absolute paths. */
export const worktreePaths = (main: string): string[] => {
  const run = gitRun(main, ["worktree", "list", "--porcelain"]);

  return run.ok
    ? run.out
        .split("\n")
        .filter((line) => line.startsWith("worktree "))
        .map((line) => line.slice("worktree ".length))
    : [];
};
