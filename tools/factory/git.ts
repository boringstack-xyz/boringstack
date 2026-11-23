import { spawnSync } from "node:child_process";

/** What `rev-parse --abbrev-ref HEAD` prints for a detached checkout. */
export const DETACHED_HEAD = "HEAD";

/** Runs git in `dir`; undefined when it fails. Output is trimmed. */
export const git = (
  dir: string,
  args: readonly string[]
): string | undefined => {
  const run = spawnSync("git", ["-C", dir, ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });

  return run.status === 0 ? run.stdout.trim() : undefined;
};

/** The checkout's current branch ("HEAD" when detached). */
export const currentBranch = (dir: string): string =>
  git(dir, ["rev-parse", "--abbrev-ref", "HEAD"]) ?? "";

/** True for the main worktree, false for a linked worktree (a workspace). */
export const isMainWorktree = (dir: string): boolean => {
  const gitDir = git(dir, ["rev-parse", "--absolute-git-dir"]);
  const common = git(dir, [
    "rev-parse",
    "--path-format=absolute",
    "--git-common-dir",
  ]);

  return gitDir !== undefined && gitDir === common;
};

/** The upstream a branch tracks, if it was pushed. */
export const upstreamOf = (dir: string, branch: string): string | undefined =>
  git(dir, ["rev-parse", "--abbrev-ref", `${branch}@{upstream}`]);
