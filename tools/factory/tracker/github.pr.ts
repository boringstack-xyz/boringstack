import { type IProcessRunner, mustSucceed } from "./process";

/* Pull requests through the gh CLI. Bodies travel on stdin, not in argv. */
export interface IPullRequest {
  readonly number: number;
  readonly url: string;
  readonly isDraft: boolean;
}

const isPullRequest = (value: unknown): value is IPullRequest =>
  typeof value === "object" &&
  value !== null &&
  "number" in value &&
  typeof value.number === "number" &&
  "url" in value &&
  typeof value.url === "string" &&
  "isDraft" in value &&
  typeof value.isDraft === "boolean";

/** The open pull request of a branch, when one exists (one per branch, never two). */
export const findOpenPr = (
  run: IProcessRunner,
  repo: string,
  branch: string
): IPullRequest | undefined => {
  const parsed: unknown = JSON.parse(
    mustSucceed(
      `looking for a pull request on ${branch}`,
      run("gh", [
        "pr",
        "list",
        "--repo",
        repo,
        "--head",
        branch,
        "--state",
        "open",
        "--json",
        "number,url,isDraft",
      ])
    ).stdout
  );
  const listed: unknown[] = Array.isArray(parsed) ? parsed : [];
  const first = listed[0];

  return isPullRequest(first) ? first : undefined;
};

export const createPr = (
  run: IProcessRunner,
  input: {
    readonly repo: string;
    readonly base: string;
    readonly head: string;
    readonly title: string;
    readonly body: string;
    readonly draft: boolean;
    readonly cwd: string;
  }
): string => {
  const output = mustSucceed(
    "opening the pull request",
    run(
      "gh",
      [
        "pr",
        "create",
        "--repo",
        input.repo,
        "--base",
        input.base,
        "--head",
        input.head,
        "--title",
        input.title,
        "--body-file",
        "-",
        ...(input.draft ? ["--draft"] : []),
      ],
      { cwd: input.cwd, input: input.body }
    )
  ).stdout;

  return output.trim().split("\n").at(-1) ?? output.trim();
};

/** Updates the title and body, and the draft state when it differs. */
export const updatePr = (
  run: IProcessRunner,
  input: {
    readonly repo: string;
    readonly pr: IPullRequest;
    readonly title: string;
    readonly body: string;
    readonly draft: boolean;
    readonly cwd: string;
  }
): void => {
  const number = String(input.pr.number);

  mustSucceed(
    `updating pull request ${input.pr.url}`,
    run(
      "gh",
      [
        "pr",
        "edit",
        number,
        "--repo",
        input.repo,
        "--title",
        input.title,
        "--body-file",
        "-",
      ],
      { cwd: input.cwd, input: input.body }
    )
  );

  if (input.pr.isDraft !== input.draft) {
    mustSucceed(
      `changing the draft state of ${input.pr.url}`,
      run(
        "gh",
        // `gh pr ready --undo` turns a ready PR back into a draft.
        [
          "pr",
          "ready",
          number,
          "--repo",
          input.repo,
          ...(input.draft ? ["--undo"] : []),
        ],
        { cwd: input.cwd }
      )
    );
  }
};
