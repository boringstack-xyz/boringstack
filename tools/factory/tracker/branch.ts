import type { IFactoryContext } from "../context";
import { git } from "../git";

/*
 * Branch facts the tracker commands need. A branch counts as pushed only when
 * origin's copy is exactly the local tip, so a card never points at work that
 * exists only on this machine.
 */
export const isPushed = (context: IFactoryContext, branch: string): boolean => {
  const remote = git(context.root, [
    "rev-parse",
    "--verify",
    "--quiet",
    `refs/remotes/origin/${branch}`,
  ]);
  const local = git(context.root, [
    "rev-parse",
    "--verify",
    "--quiet",
    `refs/heads/${branch}`,
  ]);

  return remote !== undefined && remote !== "" && remote === local;
};

/** The subject of the branch's newest commit, for a title when there is no issue title. */
export const newestSubject = (
  context: IFactoryContext,
  branch: string
): string | undefined =>
  git(context.root, ["log", "-1", "--format=%s", branch]);
