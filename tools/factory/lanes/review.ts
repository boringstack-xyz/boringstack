/*
 * The independent reviewer's verdict goes into the verification record that
 * the pull request body carries, in its "Review" section, so one record holds
 * what the author checked and what the reviewer found. Only that section is
 * replaced; the rest of the body is left as it is.
 */
const HEADING = /^#{2,3} /u;

/** Replaces the text under a "## Review" heading (added at the end when missing). */
export const replaceReviewSection = (body: string, review: string): string => {
  const lines = body.split("\n");
  const start = lines.findIndex(
    (line) =>
      HEADING.test(line) && line.replace(HEADING, "").trim() === "Review"
  );
  const text = review.trim();

  if (start < 0) {
    return `${body.trimEnd()}\n\n## Review\n\n${text}\n`;
  }

  const rest = lines.slice(start + 1);
  const next = rest.findIndex((line) => HEADING.test(line));
  const after = next < 0 ? [] : rest.slice(next);

  return [...lines.slice(0, start + 1), "", text, "", ...after].join("\n");
};
