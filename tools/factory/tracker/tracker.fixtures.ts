import type {
  IProcessOptions,
  IProcessResult,
  IProcessRunner,
} from "./process";
import type { ITrackerDeps } from "./select";

/* Test doubles for the tracker: a gh runner that answers by its arguments, and a record. */

/** The command deps around a fake gh runner; the tests reach no network. */
export const depsOf = (fake: {
  readonly run: IProcessRunner;
}): ITrackerDeps => ({
  run: fake.run,
  http: () => Promise.reject(new Error("the tests reach no network")),
});

/** The message a promise rejects with; the test fails when it resolves instead. */
export const rejectionOf = async (work: Promise<unknown>): Promise<string> => {
  try {
    await work;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }

  throw new Error("expected the call to fail, but it succeeded");
};

export interface IRecordedCall {
  readonly command: string;
  readonly args: readonly string[];
  readonly input: string | undefined;
}

export const okResult = (stdout = ""): IProcessResult => ({
  status: 0,
  stdout,
  stderr: "",
});

export const failResult = (stderr: string): IProcessResult => ({
  status: 1,
  stdout: "",
  stderr,
});

/** A runner that records every call and answers with `answer` (default: success, empty). */
export const fakeRunner = (
  answer: (
    command: string,
    args: readonly string[],
    options: IProcessOptions | undefined
  ) => IProcessResult | undefined = () => undefined
): { run: IProcessRunner; calls: IRecordedCall[] } => {
  const calls: IRecordedCall[] = [];

  const run: IProcessRunner = (command, args, options) => {
    calls.push({ command, args: [...args], input: options?.input });

    return answer(command, args, options) ?? okResult();
  };

  return { run, calls };
};

/** The text of a complete verification record for `commit`, passing `verification check`. */
export const completeRecord = (input: {
  readonly branch: string;
  readonly commit: string;
  readonly risk?: string;
  readonly notVerified?: string;
}): string =>
  [
    `# Verification: ${input.branch}`,
    "",
    `Commit: ${input.commit}`,
    "Issue: 12",
    "",
    "## Checks run",
    "",
    "```",
    "factory verify: api passed, ui passed",
    "```",
    "",
    "## Risk",
    "",
    input.risk ?? "ui: button copy on the billing page",
    "",
    "## Walked in browser",
    "",
    "- /billing: the new copy shows; the button still submits",
    "",
    "## Review",
    "",
    "- nothing to fix",
    "",
    "## Not verified",
    "",
    input.notVerified ?? "- the Safari layout (no Safari in the stack)",
    "",
    "## For the next session",
    "",
    "Nothing",
    "",
    "## Build note",
    "",
    "Nothing to learn: a copy change",
    "",
  ].join("\n");
