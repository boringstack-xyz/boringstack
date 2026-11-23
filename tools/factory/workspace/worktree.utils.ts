/** What a workspace still holds that deleting it would lose. */
export interface IWorkReport {
  /** Changed or untracked files that are not committed. */
  readonly uncommitted: number;
  /** Commits on this checkout that no remote branch has. */
  readonly unpushed: number;
  /** Set when git could not answer; the work must then count as held. */
  readonly unknown: boolean;
}

/** Counts the entries `git status --porcelain` lists. */
export const uncommittedCount = (porcelain: string): number =>
  porcelain.split("\n").filter((line) => line.trim() !== "").length;

/** Parses `git rev-list --count`; undefined when the output is not a number. */
export const parseCount = (text: string): number | undefined => {
  const count = Number(text.trim());

  return text.trim() !== "" && Number.isInteger(count) && count >= 0
    ? count
    : undefined;
};

/** Work is safe to discard only when git answered and found nothing. */
export const isSafeToDiscard = (report: IWorkReport): boolean =>
  !report.unknown && report.uncommitted === 0 && report.unpushed === 0;

/** The words a person reads about held work. */
export const describeWork = (report: IWorkReport): string => {
  const parts: string[] = [];

  if (report.unknown) {
    parts.push("git could not say whether everything is saved");
  }

  if (report.uncommitted > 0) {
    parts.push(`${String(report.uncommitted)} changed file(s) not committed`);
  }

  if (report.unpushed > 0) {
    parts.push(`${String(report.unpushed)} commit(s) not pushed`);
  }

  return parts.length === 0 ? "nothing unsaved" : parts.join("; ");
};
