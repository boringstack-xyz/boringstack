/*
 * Filing a finding as an issue. `IIssueFiler` is the factory's seam to a
 * tracker: the tracker adapter (tools/factory/tracker/) implements it for
 * Linear; until then the GitHub implementation here runs `gh issue create`
 * through an injected runner. Tests never reach gh.
 */
import type { IFinding } from "./findings.utils";
import type { ProcessRunner } from "./process";

export interface IFiledIssue {
  readonly url: string;
}

export interface IIssueFiler {
  /** Files one finding; resolves with the new issue, rejects with a plain reason. */
  readonly file: (finding: IFinding) => Promise<IFiledIssue>;
}

/** The issue title: the service and the message's shape, never the message. */
export const issueTitleOf = (finding: IFinding): string =>
  `[log error] ${finding.service}: ${finding.signature.replace(/\s+/gu, " ").slice(0, 90)}`;

/** The issue body: what was seen, where to read it, and the finding's id for the ledger. */
export const issueBodyOf = (finding: IFinding): string =>
  [
    `The \`${finding.service}\` service logged this error in the factory's stacks.`,
    "",
    "Message shape (ids, numbers and quoted values blanked):",
    "",
    "```",
    finding.signature,
    "```",
    "",
    `- Seen ${String(finding.count)} time(s) in the last factory findings scan.`,
    `- First seen ${finding.firstSeen}, last seen ${finding.lastSeen}.`,
    "",
    `Read it in context with \`bun run factory logs --summary\`.`,
    "",
    "Done when the message is gone from the logs, or it is listed with a reason in `tools/factory/expected-log-findings.json`.",
    "",
    `Finding \`${finding.id}\` (\`bun run factory findings\`).`,
  ].join("\n");

const GITHUB_ISSUE_URL = /^https:\/\/github\.com\/\S+\/issues\/\d+$/u;

/** Files issues with `gh issue create`, in the checkout the command runs from. */
export const githubIssueFiler = (
  run: ProcessRunner,
  cwd: string
): IIssueFiler => ({
  file: (finding) => {
    const result = run(
      "gh",
      ["issue", "create", "--title", issueTitleOf(finding), "--body-file", "-"],
      { cwd, input: issueBodyOf(finding), timeoutMs: 60_000 }
    );

    if (result.status !== 0) {
      return Promise.reject(
        new Error(
          `gh issue create failed (exit ${String(result.status)}): ${result.stderr.trim().slice(0, 300)}`
        )
      );
    }

    const url = result.stdout.trim().split("\n").at(-1) ?? "";

    return GITHUB_ISSUE_URL.test(url)
      ? Promise.resolve({ url })
      : Promise.reject(new Error("gh issue create printed no issue address"));
  },
});
