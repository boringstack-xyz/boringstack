/*
 * The verification record of a change: what was checked, how, and above all
 * what was not. `factory verify` fills in the checks it ran; the agent writes
 * the rest. It goes into the hand-over and the pull request body, and a
 * change is not handed over while it is incomplete. Ported from the
 * Dreamdata factory (verify/src/verification.utils.ts).
 */
import { namedRisk, type Risk, RISK_MEANING } from "../risk/risk";

export const TODO = "TODO";

/** Risk levels, lowest first, with who merges each one (see ../risk/risk.ts). */
export const RISK_LEVELS = RISK_MEANING;

export type RiskLevel = Risk;

export const AGENT_SECTIONS = [
  {
    title: "Risk",
    ask: `One of ${Object.keys(RISK_LEVELS).join(", ")}, a colon, and why (the highest level any part of the change reaches), e.g. "low: button copy on the billing page". The changed paths can raise it, never lower it.`,
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

/** The risk level a record names, if it names a valid one (older kinds read as levels). */
export const riskOf = (text: string): RiskLevel | undefined => {
  const body = section(text, "Risk");

  return body === undefined ? undefined : namedRisk(`## Risk\n\n${body}`);
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
