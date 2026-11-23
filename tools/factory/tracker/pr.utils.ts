/*
 * Pure parts of `factory pr`: the pull request's title and body. The title is
 * a conventional commit (it becomes the squash commit on main); the body
 * starts with the change's risk, so a reviewer knows how deep to read.
 */
export const TITLE_TYPES = [
  "feat",
  "fix",
  "perf",
  "refactor",
  "test",
  "docs",
  "build",
  "ci",
  "chore",
  "style",
  "revert",
  "deps",
] as const;

const TITLE_LIMIT = 100;
const CONVENTIONAL = new RegExp(
  `^(?:${TITLE_TYPES.join("|")})(?:\\([a-z0-9][a-z0-9._/-]*\\))?!?: \\S`,
  "u"
);

/** The commit type an issue's labels name; a feature when none does. */
const typeOf = (labels: readonly string[]): (typeof TITLE_TYPES)[number] => {
  const named = labels.map((label) => label.toLowerCase());

  if (named.some((label) => label === "bug" || label === "fix")) {
    return "fix";
  }

  if (named.some((label) => label === "documentation" || label === "docs")) {
    return "docs";
  }

  if (named.includes("chore")) {
    return "chore";
  }

  return "feat";
};

/**
 * `<type>: <issue title>`, within the commit-title limit. An issue title that
 * already is conventional is kept as it is.
 */
export const conventionalTitle = (input: {
  readonly issueTitle: string;
  readonly labels: readonly string[];
  readonly fallback: string;
}): string => {
  const fromIssue = input.issueTitle.trim();
  const words = (fromIssue === "" ? input.fallback.trim() : fromIssue)
    .replace(/\s+/gu, " ")
    .replace(/\.$/u, "");

  if (CONVENTIONAL.test(words)) {
    return words.slice(0, TITLE_LIMIT);
  }

  const head = `${typeOf(input.labels)}: `;
  const summary = words === "" ? "factory change" : words;

  return `${head}${summary}`.slice(0, TITLE_LIMIT).trimEnd();
};

/** The record without its own "# Verification: <branch>" title: the PR's "## Verification" heads it. */
const withoutTitle = (record: string): string =>
  record
    .trim()
    .replace(/^# Verification:[^\n]*\n*/u, "")
    .trim();

/** A "#" heading one level deeper, so the record sits under the PR's own headings. */
const demote = (text: string): string =>
  text
    .split("\n")
    .map((line) => (/^#{1,5}\s/u.test(line) ? `#${line}` : line))
    .join("\n");

/**
 * The PR body: Risk on the first line, then the link to the issue, then the
 * record. A draft says why it is one.
 */
export const prBody = (input: {
  readonly risk: string | undefined;
  readonly reason: string;
  readonly reference: string;
  readonly record: string;
  readonly problems: readonly string[];
}): string => {
  const risk =
    input.risk === undefined
      ? "**Risk: not set**"
      : `**Risk: ${input.risk}**${input.reason === "" ? "" : ` (${input.reason})`}`;

  return [
    risk,
    "",
    input.reference,
    "",
    ...(input.problems.length > 0
      ? [
          "Draft: the verification record is not complete yet:",
          ...input.problems.map((problem) => `- ${problem}`),
          "",
        ]
      : []),
    "## Verification",
    "",
    input.record.trim() === ""
      ? "There is no verification record for this branch yet."
      : demote(withoutTitle(input.record)),
    "",
  ].join("\n");
};

/** The first URL in a gh output (gh prints the new PR's URL last). */
export const urlIn = (output: string): string | undefined =>
  /https:\/\/\S+/u.exec(output)?.[0];
