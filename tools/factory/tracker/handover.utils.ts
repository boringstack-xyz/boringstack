/*
 * Pure parts of `factory handover`: the one card a person reads on the issue.
 * Plain language: it says what to try and what was not checked, not how the
 * code is organised.
 */
import {
  commitOf,
  notVerifiedItems,
  RISK_LEVELS,
  riskOf,
  section,
  TODO,
} from "../record/verification.utils";

export interface ICardInput {
  readonly title: string;
  readonly branch: string;
  /** The preview a person can try the change in, when one is running. */
  readonly preview: string | undefined;
  /** The verification record, complete (the caller checks it first). */
  readonly record: string;
}

/** "ui: copy on the billing page" → the reason part, or "" when none is written. */
export const riskReason = (record: string): string => {
  const level = riskOf(record);
  const text = section(record, "Risk") ?? "";

  return level === undefined ? "" : text.slice(level.length + 1).trim();
};

/** What the record says the author walked in the browser, when it says anything real. */
const walkedText = (record: string): string | undefined => {
  const text = section(record, "Walked in browser")?.trim() ?? "";

  return text === "" || text.includes(TODO) ? undefined : text;
};

/** The card's markdown, without its marker (the adapter adds it). */
export const handoverCard = (input: ICardInput): string => {
  const risk = riskOf(input.record);
  const reason = riskReason(input.record);
  const walked = walkedText(input.record);
  const gaps = notVerifiedItems(input.record);
  const commit = commitOf(input.record);
  const checkedAt =
    commit === undefined ? "" : `, checks ran at commit ${commit}`;
  const because = reason === "" ? "" : ` (${reason})`;

  return [
    `### Ready to review: ${input.title}`,
    "",
    input.preview === undefined
      ? "**Preview:** none is running for this change. Ask for one before reviewing."
      : `**Preview:** ${input.preview}`,
    "",
    "**How to try it:** open the preview and check each acceptance criterion on this issue.",
    "",
    ...(risk === undefined
      ? ["**How much review:** not set. The record names no risk level."]
      : [`**How much review:** ${risk}${because}. ${RISK_LEVELS[risk]}`]),
    "",
    "**What was checked in the browser:**",
    walked ?? "Nothing written yet.",
    "",
    "**Not verified** (look here first):",
    ...(gaps.length > 0
      ? gaps.map((gap) => `- ${gap}`)
      : ["Nothing left unverified."]),
    "",
    `Verification record: complete${checkedAt}.`,
    "",
    `Branch: \`${input.branch}\``,
  ].join("\n");
};
