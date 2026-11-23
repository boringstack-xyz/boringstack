/**
 * Whether a status line or title is in plain words. The fleet page is read by
 * people who never saw the code, so branch names, file paths, issue ids,
 * table-style names, code and stack traces are refused, with what to take out.
 * Word choice stays the writer's. Port of the reference fleet/src/plain.utils.ts.
 */

/** A status is one sentence. */
export const MAX_LENGTH = 160;

const FILE_ENDING =
  /(?<![\w/])[\w.-]+\.(?:ts|tsx|js|mjs|json|sql|md|ya?ml|sh|css|html|env)\b/gu;

const unique = (found: readonly string[]): string[] => [...new Set(found)];

const quoted = (found: readonly string[]): string =>
  unique(found)
    .map((one) => `"${one}"`)
    .join(", ");

export const plainProblems = (text: string): string[] => {
  const line = text.trim();
  const problems: string[] = [];

  if (line === "") {
    return ["it is empty"];
  }

  if (line.length > MAX_LENGTH) {
    problems.push(
      `it is ${String(line.length)} characters long; keep it to one sentence (${String(MAX_LENGTH)} at most)`
    );
  }

  const ids = line.match(/\b[A-Za-z]{2,10}-\d+\b/gu) ?? [];

  if (ids.length > 0) {
    problems.push(
      `the issue id ${quoted(ids)} (the page links the issue already)`
    );
  }

  const branches =
    line.match(/\b(?:factory|feat|fix|chore|ci|docs)\/[\w./-]+/gu) ?? [];

  if (branches.length > 0) {
    problems.push(`the branch name ${quoted(branches)}`);
  }

  const names = line.match(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/giu) ?? [];

  if (names.length > 0) {
    problems.push(
      `the name ${quoted(names)} (a table, column or account: say what it holds)`
    );
  }

  const paths =
    line.match(
      /(?:^|\s)(?:apps|infra|tools|packages|docs|scripts)\/[\w./-]+|\/[\w.-]+\/[\w./-]+/gu
    ) ?? [];
  const code = [
    ...(line.match(/`[^`]*`/gu) ?? []),
    ...(line.match(FILE_ENDING) ?? []),
    ...(line.match(/\bhttps?:\/\/\S+/gu) ?? []),
    ...paths.map((path) => path.trim()),
  ];

  if (code.length > 0) {
    problems.push(`the code, file, path or link ${quoted(code)}`);
  }

  if (/\bError:|Traceback \(|\bat \S+ \([^)]*:\d+:\d+\)/u.test(line)) {
    problems.push("a stack trace or error dump");
  }

  return problems;
};

/** The whole refusal, as `status` prints it. */
export const refusal = (
  kind: "status" | "title",
  problems: readonly string[]
): string =>
  [
    `this ${kind} is read on the fleet page by people who never saw the code.`,
    `Take out: ${problems.join("; ")}.`,
    kind === "title"
      ? 'Name the feature as its user would: "Impressions and spend in reports".'
      : 'Say what is being done for the product\'s user: "Bringing impressions into the reports".',
  ].join(" ");
