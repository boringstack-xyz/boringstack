/*
 * Pure parts of `factory issue`: the acceptance criteria an issue states and
 * the text a person reads about it.
 */
import type { IIssue } from "./tracker.types";

const CRITERIA_HEADING =
  /^(?:#{1,6}\s+|\*\*)?acceptance criteria:?(?:\*\*)?\s*$/iu;
const ANY_HEADING = /^#{1,6}\s/u;
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.+?)\s*$/u;
const CHECKBOX = /^\s*[-*+]\s+\[[ xX]\]\s+(.+?)\s*$/u;

/**
 * The criteria an issue states: the items under an "Acceptance criteria"
 * heading, or, when there is no such heading, every checklist item in the body.
 */
export const acceptanceCriteria = (body: string): string[] => {
  const lines = body.split("\n");
  const headingAt = lines.findIndex((line) =>
    CRITERIA_HEADING.test(line.trim())
  );

  if (headingAt < 0) {
    return lines.flatMap((line) => CHECKBOX.exec(line)?.[1] ?? []);
  }

  const rest = lines.slice(headingAt + 1);
  const end = rest.findIndex((line) => ANY_HEADING.test(line));

  return (end < 0 ? rest : rest.slice(0, end)).flatMap(
    (line) => LIST_ITEM.exec(line)?.[1] ?? []
  );
};

/** What a person reads about an issue before building it. */
export const issueText = (issue: IIssue, criteria: readonly string[]): string =>
  [
    `${issue.id}: ${issue.title}`,
    "",
    `Labels: ${issue.labels.length > 0 ? issue.labels.join(", ") : "none"}`,
    "",
    "Acceptance criteria:",
    ...(criteria.length > 0
      ? criteria.map((criterion) => `- ${criterion}`)
      : [
          "- none written. The issue needs them before it is built; a person writes them.",
        ]),
    "",
    "---",
    issue.body.trim() === ""
      ? "(the issue has no description)"
      : issue.body.trim(),
  ].join("\n");
