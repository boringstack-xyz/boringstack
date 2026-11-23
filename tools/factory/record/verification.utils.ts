/*
 * The verification record of a change: what was checked, how, and above all
 * what was not. `factory verify` fills in the checks it ran; the agent writes
 * the rest. It goes into the hand-over and the pull request body, and a
 * change is not handed over while it is incomplete. Ported from the
 * Dreamdata factory (verify/src/verification.utils.ts).
 */
export const TODO = "TODO";

/** Risk levels, lowest first, with the review each one asks for. */
export const RISK_LEVELS = {
  ui: "Copy, layout or styling only; no logic, data or permissions. One reviewer reads this record and the preview.",
  logic:
    "Behaviour in the app or the API. One reviewer reads this record first, then the code.",
  data: "A migration, a queue, or anything that writes stored data. Full code review.",
  "auth-billing":
    "Sign-in, permissions, plans, billing, secrets, or anything customer-facing outside the app (emails). Full code review and a second reviewer.",
} as const;

export type RiskLevel = keyof typeof RISK_LEVELS;

const isRiskLevel = (value: string): value is RiskLevel =>
  Object.hasOwn(RISK_LEVELS, value);

export const AGENT_SECTIONS = [
  {
    title: "Risk",
    ask: `One of ${Object.keys(RISK_LEVELS).join(", ")}, a colon, and why (the highest level any part of the change reaches), e.g. "ui: button copy on the billing page".`,
  },
  {
    title: "Walked in browser",
    ask: "Each page or flow you opened and what you saw (screenshots by path, from factory walk); every acceptance criterion by name.",
  },
  {
    title: "Review",
    ask: "Each finding of a fresh-context review of the diff against the issue text: fixed (how) or dismissed (why).",
  },
  {
    title: "Not verified",
    ask: 'What you could not check, and why. "Nothing" only if that is true.',
  },
  {
    title: "For the next session",
    ask: 'What a skill, AGENTS.md or a guide got wrong or left out, each with the change that fixes it. "Nothing" only if that is true.',
  },
  {
    title: "Build note",
    ask: 'The note this build leaves in docs/build-notes/ (its path), or "Nothing to learn: <why>" for a change too small to teach anything.',
  },
] as const;

const COMMIT_LINE = /^Commit: ([0-9a-f]{7,40})$/mu;

/** A new record: the commit it describes, the checks run, the agent's sections asked. */
export const draft = (input: {
  branch: string;
  commit: string;
  issue: string | undefined;
  checks: string | undefined;
}): string =>
  [
    `# Verification: ${input.branch}`,
    "",
    `Commit: ${input.commit}`,
    ...(input.issue === undefined ? [] : [`Issue: ${input.issue}`]),
    "",
    "## Checks run",
    "",
    "```",
    input.checks?.trim() ?? "No verify run found; run bun run factory verify.",
    "```",
    "",
    ...AGENT_SECTIONS.flatMap((item) => [
      `## ${item.title}`,
      "",
      `${TODO}: ${item.ask}`,
      "",
    ]),
  ].join("\n");

/** A section's text without its heading; undefined when it is not there. */
export const section = (text: string, title: string): string | undefined => {
  const heading = /^#{2,3} /u;
  const lines = text.split("\n");
  const start = lines.findIndex(
    (line) => heading.test(line) && line.replace(heading, "").trim() === title
  );

  if (start < 0) {
    return undefined;
  }

  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => heading.test(line));

  return (end < 0 ? rest : rest.slice(0, end)).join("\n").trim();
};

export const commitOf = (text: string): string | undefined =>
  COMMIT_LINE.exec(text)?.[1];

/** The risk level a record names, if it names a valid one. */
export const riskOf = (text: string): RiskLevel | undefined => {
  const level = (section(text, "Risk") ?? "").split(":")[0]?.trim() ?? "";

  return isRiskLevel(level) ? level : undefined;
};

/**
 * What a record still lacks. Empty when complete and current: every section
 * written (no TODO), a valid risk level, checks that ran, and the commit it
 * describes is the branch's head.
 */
export const problems = (text: string, head: string): string[] => {
  const missing = [
    "Checks run",
    ...AGENT_SECTIONS.map((item) => item.title),
  ].flatMap((title) => {
    const body = section(text, title);

    if (body === undefined) {
      return [`section "${title}" is missing`];
    }

    return body === "" || body.includes(TODO)
      ? [`section "${title}" is not written`]
      : [];
  });
  const checks = section(text, "Checks run") ?? "";
  const commit = commitOf(text);

  return [
    ...missing,
    ...(section(text, "Risk") !== undefined && riskOf(text) === undefined
      ? [`Risk must start with one of ${Object.keys(RISK_LEVELS).join(", ")}`]
      : []),
    ...(checks.includes("No verify run found")
      ? ["no factory verify run is recorded"]
      : []),
    ...(commit === undefined
      ? ["the record names no commit"]
      : head.startsWith(commit) || commit.startsWith(head)
        ? []
        : [
            `the record describes ${commit.slice(0, 12)}, but the branch is at ${head.slice(0, 12)}; run verify again and refresh it`,
          ]),
  ];
};

/** "Not verified" items of a record, one per bullet line, for the weekly gap review. */
export const notVerifiedItems = (text: string): string[] =>
  (section(text, "Not verified") ?? "")
    .split("\n")
    .map((line) => line.replace(/^\s*[-*]\s*/u, "").trim())
    .filter((line) => line !== "" && !/^nothing\.?$/iu.test(line));
