/*
 * Pure parts of the tracker adapters: which comment an upsert edits, which
 * labels or workflow state a state means, and where a repository is.
 */
import type { IComment, IssueState } from "./tracker.types";

/** The hidden marker that makes the hand-over card one comment, edited in place. */
export const HANDOVER_MARKER = "<!-- factory:handover -->";

/** GitHub labels that carry an issue's factory state. */
export const GITHUB_STATE_LABELS: Readonly<
  Record<IssueState, { add: string; remove: readonly string[] }>
> = {
  review: { add: "factory:review", remove: ["factory:in-progress"] },
};

/** Linear workflow state names a factory state maps to, matched case-insensitively. */
export const LINEAR_STATE_PATTERNS: Readonly<Record<IssueState, RegExp>> = {
  review: /\breview\b/iu,
};

export type UpsertPlan =
  | { readonly action: "create" }
  | { readonly action: "update"; readonly id: string };

/**
 * The first comment holding the marker is the card: it is edited, never a
 * second one added. Older duplicates are left alone.
 */
export const planUpsert = (
  comments: readonly IComment[],
  marker: string
): UpsertPlan => {
  const found = comments.find((comment) => comment.body.includes(marker));

  return found === undefined
    ? { action: "create" }
    : { action: "update", id: found.id };
};

/** The body with its marker first, so every later run finds the same comment. */
export const withMarker = (body: string, marker: string): string => {
  const rest = body.startsWith(marker) ? body.slice(marker.length) : body;

  return `${marker}\n${rest.trim()}\n`;
};

/** The Linear workflow state id for a factory state, or undefined when the team has none. */
export const linearStateId = (
  states: readonly { id: string; name: string; type: string }[],
  state: IssueState
): string | undefined => {
  const pattern = LINEAR_STATE_PATTERNS[state];
  const matching = states.filter((entry) => pattern.test(entry.name));
  // A started state ("In Review") beats any other name that happens to match.
  const preferred =
    matching.find((entry) => entry.type === "started") ?? matching[0];

  return preferred?.id;
};

/** owner/name from a GitHub remote (https or ssh), undefined for anything else. */
export const repoSlugOf = (remote: string | undefined): string | undefined =>
  remote === undefined
    ? undefined
    : /github\.com[:/]([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/u.exec(
        remote.trim()
      )?.[1];
